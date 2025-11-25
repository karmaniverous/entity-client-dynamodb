import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
import { execaCommand } from 'execa';

import type { DynamodbPluginConfig } from '../cli/options/types';

type LocalCfg = NonNullable<DynamodbPluginConfig['local']>;

export function deriveEndpoint(
  cfg?: LocalCfg,
  envRef: Record<string, string | undefined> = process.env,
  overridePort?: number,
): { endpoint: string; port: number } {
  // Prefer override, then configured numeric port, then env var coerced to number.
  // Use Number(NaN) pattern to avoid ternary and still filter via isFinite guard below.
  const basePort: number | undefined =
    overridePort ?? cfg?.port ?? Number(envRef.DYNAMODB_LOCAL_PORT ?? NaN);

  const port =
    typeof basePort === 'number' && Number.isFinite(basePort) && basePort > 0
      ? basePort
      : 8000;

  const endpoint =
    cfg?.endpoint ??
    (cfg?.port !== undefined
      ? `http://localhost:${String(cfg.port)}`
      : undefined) ??
    envRef.DYNAMODB_LOCAL_ENDPOINT ??
    `http://localhost:${String(port)}`;

  return { endpoint, port };
}

async function libraryAvailable(): Promise<
  | {
      setupDynamoDbLocal: (port?: number) => Promise<void>;
      teardownDynamoDbLocal: () => Promise<void>;
      dynamoDbLocalReady: (client: DynamoDBClient) => Promise<void>;
    }
  | undefined
> {
  try {
    const mod: unknown = await import('@karmaniverous/dynamodb-local');
    // Best-effort structural guard
    if (
      mod &&
      typeof mod === 'object' &&
      'setupDynamoDbLocal' in (mod as Record<string, unknown>) &&
      'teardownDynamoDbLocal' in (mod as Record<string, unknown>) &&
      'dynamoDbLocalReady' in (mod as Record<string, unknown>)
    ) {
      return mod as {
        setupDynamoDbLocal: (port?: number) => Promise<void>;
        teardownDynamoDbLocal: () => Promise<void>;
        dynamoDbLocalReady: (client: DynamoDBClient) => Promise<void>;
      };
    }
  } catch {
    // ignore
  }
  return undefined;
}

function makeClient(endpoint: string): DynamoDBClient {
  return new DynamoDBClient({
    region: 'local',
    endpoint,
    credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
  });
}

async function probeReadyWithSdk(endpoint: string): Promise<boolean> {
  const client = makeClient(endpoint);
  const maxAttempts = 50;
  const delayMs = 100;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await client.send(new ListTablesCommand({ Limit: 1 }));
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

export async function startLocal(args: {
  cfg?: LocalCfg;
  envRef?: Record<string, string | undefined>;
  shell?: string | boolean;
  capture?: boolean;
  portOverride?: number;
}): Promise<{ endpoint: string }> {
  const { cfg, envRef = process.env, shell, capture, portOverride } = args;
  const { endpoint, port } = deriveEndpoint(cfg, envRef, portOverride);
  const env = buildSpawnEnv(process.env, envRef);

  if (cfg?.start) {
    // Config-driven
    await execaCommand(cfg.start, {
      env,
      stdio: capture ? 'pipe' : 'inherit',
      ...(shell !== undefined ? { shell } : {}),
    });
    // Readiness: library first, else SDK probe
    const lib = await libraryAvailable();
    if (lib) {
      const client = makeClient(endpoint);
      await lib.dynamoDbLocalReady(client);
    } else {
      const ok = await probeReadyWithSdk(endpoint);
      if (!ok)
        throw new Error(
          `local dynamodb start: endpoint ${endpoint} not ready after start`,
        );
    }
    return { endpoint };
  }

  // Embedded fallback
  const lib = await libraryAvailable();
  if (!lib) {
    throw new Error(
      'No local orchestration configured. Set plugins.dynamodb.local.start or install @karmaniverous/dynamodb-local',
    );
  }
  await lib.setupDynamoDbLocal(port);
  const client = makeClient(endpoint);
  await lib.dynamoDbLocalReady(client);
  return { endpoint };
}

export async function stopLocal(args: {
  cfg?: LocalCfg;
  envRef?: Record<string, string | undefined>;
  shell?: string | boolean;
  capture?: boolean;
}): Promise<void> {
  const { cfg, envRef = process.env, shell, capture } = args;
  const env = buildSpawnEnv(process.env, envRef);

  if (cfg?.stop) {
    await execaCommand(cfg.stop, {
      env,
      stdio: capture ? 'pipe' : 'inherit',
      ...(shell !== undefined ? { shell } : {}),
    });
    return;
  }
  const lib = await libraryAvailable();
  if (!lib) {
    throw new Error(
      'No local orchestration configured. Set plugins.dynamodb.local.stop or install @karmaniverous/dynamodb-local',
    );
  }
  await lib.teardownDynamoDbLocal();
}

export async function statusLocal(args: {
  cfg?: LocalCfg;
  envRef?: Record<string, string | undefined>;
  shell?: string | boolean;
  capture?: boolean;
  portOverride?: number;
}): Promise<boolean> {
  const { cfg, envRef = process.env, shell, capture, portOverride } = args;
  const { endpoint } = deriveEndpoint(cfg, envRef, portOverride);
  const env = buildSpawnEnv(process.env, envRef);

  if (cfg?.status) {
    try {
      await execaCommand(cfg.status, {
        env,
        stdio: capture ? 'pipe' : 'inherit',
        ...(shell !== undefined ? { shell } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }
  // Health probe
  const ok = await probeReadyWithSdk(endpoint);
  return ok;
}
