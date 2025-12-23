import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
import {
  runCommand,
  runCommandResult,
} from '@karmaniverous/get-dotenv/cliHost';

import type { DynamodbPluginConfig } from '../cli/options/types';

type LocalCfg = NonNullable<DynamodbPluginConfig['local']>;

/**
 * Derive an effective local DynamoDB endpoint and port.
 *
 * @param cfg - Local DynamoDB plugin config slice.
 * @param envRef - Env overlay (typically `{ ...process.env, ...ctx.dotenv }`).
 * @param overridePort - Optional port override (from flags).
 * @returns Derived endpoint and port.
 */
export function deriveEndpoint(
  cfg?: LocalCfg,
  envRef: Record<string, string | undefined> = process.env,
  overridePort?: number,
): { endpoint: string; port: number } {
  const cfgPortRaw = cfg?.port;
  const cfgPort =
    typeof cfgPortRaw === 'string' ? Number(cfgPortRaw) : cfgPortRaw;

  // Prefer override, then configured numeric port, then env var coerced to number.
  // Use Number(NaN) pattern to avoid ternary and still filter via isFinite guard below.
  const basePort: number | undefined =
    overridePort ?? cfgPort ?? Number(envRef.DYNAMODB_LOCAL_PORT ?? NaN);

  const port =
    typeof basePort === 'number' && Number.isFinite(basePort) && basePort > 0
      ? basePort
      : 8000;

  const endpoint =
    cfg?.endpoint ??
    (cfgPortRaw !== undefined
      ? `http://localhost:${String(cfgPortRaw)}`
      : undefined) ??
    envRef.DYNAMODB_LOCAL_ENDPOINT ??
    `http://localhost:${String(port)}`;

  return { endpoint, port };
}

async function runConfigCommand(args: {
  command: string;
  env: NodeJS.ProcessEnv;
  shell?: string | boolean;
  capture?: boolean;
}): Promise<number> {
  const { command, env, capture } = args;
  // Config commands are string payloads; always run them under a shell.
  const shell = args.shell === false ? true : (args.shell ?? true);

  if (capture) {
    const { exitCode } = await runCommandResult(command, shell, { env });
    return exitCode;
  }

  // Inherit stdio for interactive/long-running local orchestration.
  return runCommand(command, shell, { env, stdio: 'inherit' });
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

/**
 * Start local DynamoDB using a config command (preferred) or the embedded library fallback.
 *
 * @param args - Start options.
 * @returns Effective endpoint (for UX / downstream wiring).
 */
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
    const exitCode = await runConfigCommand({
      command: cfg.start,
      env,
      shell,
      capture,
    });
    if (exitCode !== 0)
      throw new Error(`local dynamodb start: exit ${exitCode}`);
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

/**
 * Stop local DynamoDB using a config command (preferred) or the embedded library fallback.
 *
 * @param args - Stop options.
 */
export async function stopLocal(args: {
  cfg?: LocalCfg;
  envRef?: Record<string, string | undefined>;
  shell?: string | boolean;
  capture?: boolean;
}): Promise<void> {
  const { cfg, envRef = process.env, shell, capture } = args;
  const env = buildSpawnEnv(process.env, envRef);

  if (cfg?.stop) {
    const exitCode = await runConfigCommand({
      command: cfg.stop,
      env,
      shell,
      capture,
    });
    if (exitCode !== 0)
      throw new Error(`local dynamodb stop: exit ${exitCode}`);
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

/**
 * Check local DynamoDB status using a config command (preferred) or an SDK health probe.
 *
 * @param args - Status options.
 * @returns True when healthy/running; false otherwise.
 */
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
      const exitCode = await runConfigCommand({
        command: cfg.status,
        env,
        shell,
        capture,
      });
      return exitCode === 0;
    } catch {
      return false;
    }
  }
  // Health probe
  const ok = await probeReadyWithSdk(endpoint);
  return ok;
}
