/**
 * CLI option resolvers for the "dynamodb" get-dotenv plugin.
 *
 * Responsibilities:
 * - Precedence: CLI flags > plugins.dynamodb config > defaults.
 * - Dotenv expansion for all string options using a provided env ref.
 * - Stable mapping to VersionedLayoutConfig and service input shapes.
 *
 * No runtime host coupling here; keep these helpers pure. The host/plugin layer
 * will call them and wire outputs to services.
 */

import type { WaiterConfig } from '../../EntityClient/WaiterConfig';
import type { VersionedLayoutConfig } from '../layout';

export type EnvRef = Record<string, string | undefined>;

/** Minimal plugin config surface (plugins.dynamodb). */
export interface DynamodbPluginConfig {
  tablesPath?: string;
  tokens?: {
    table?: string;
    entityManager?: string;
    transform?: string;
  };
  generate?: {
    version?: string;
    overlays?: {
      billingMode?: string;
      readCapacityUnits?: number;
      writeCapacityUnits?: number;
      tableName?: string;
    };
    force?: boolean;
  };
  validate?: {
    version?: string;
  };
  create?: {
    version?: string;
    validate?: boolean;
    refreshGenerated?: boolean;
    force?: boolean;
    waiter?: { maxSeconds?: number };
    tableNameOverride?: string;
  };
  delete?: {
    tableName?: string;
    waiter?: { maxSeconds?: number };
  };
  purge?: {
    tableName?: string;
  };
  migrate?: {
    sourceTable?: string;
    targetTable?: string;
    fromVersion?: string;
    toVersion?: string;
    pageSize?: number;
    limit?: number;
    transformConcurrency?: number;
    progressIntervalMs?: number;
  };
}

/** Expand $VAR[:default] and ${VAR[:default]} recursively against ref. */
export function dotenvExpandLocal(
  value: string | undefined,
  ref: EnvRef = process.env,
): string | undefined {
  if (value === undefined) return undefined;
  let out = value;
  // Iterate until stable or small safety cap.
  for (let i = 0; i < 8; i++) {
    const before = out;
    // ${VAR[:default]}
    out = out.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::([^}]*))?\}/g,
      (_m, k: string, dflt?: string) => {
        const v = ref[k];
        return v !== undefined ? String(v) : (dflt ?? '');
      },
    );
    // $VAR[:default]
    out = out.replace(
      /\$([A-Za-z_][A-Za-z0-9_]*)(?::([^\s$]+))?/g,
      (_m, k: string, dflt?: string) => {
        const v = ref[k];
        return v !== undefined ? String(v) : (dflt ?? '');
      },
    );
    if (out === before) break;
  }
  return out;
}

/** Expand string leaves of a shallow object using ref; optionally progressive. */
export function dotenvExpandAllLocal<T extends Record<string, unknown>>(
  values: T | undefined,
  ref: EnvRef = process.env,
  progressive = false,
): T {
  const out: Record<string, unknown> = {};
  if (!values) return out as T;
  const localRef: EnvRef = progressive ? { ...ref } : ref;
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string') {
      const expanded = dotenvExpandLocal(v, localRef);
      out[k] = expanded;
      if (progressive && expanded !== undefined) localRef[k] = expanded;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** Merge in precedence order (first defined wins). */
const firstDefined = <T>(...vals: (T | undefined)[]): T | undefined =>
  vals.find((v) => v !== undefined);

/** Coerce to number when present; tolerate string input. */
const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return Number.isNaN(v) ? undefined : v;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Build VersionedLayoutConfig from flags+config with dotenv expansion. */
export function resolveLayoutConfig(
  flags: { tablesPath?: string; tokens?: DynamodbPluginConfig['tokens'] },
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): VersionedLayoutConfig {
  const tablesPath = dotenvExpandLocal(
    firstDefined(flags.tablesPath, config?.tablesPath),
    ref,
  );
  const mergedTokens = {
    ...(config?.tokens ?? {}),
    ...(flags.tokens ?? {}),
  };
  const tokens =
    Object.keys(mergedTokens).length > 0
      ? (dotenvExpandAllLocal(
          mergedTokens,
          ref,
        ) as VersionedLayoutConfig['tokens'])
      : undefined;
  return {
    ...(tablesPath ? { tablesPath } : {}),
    ...(tokens ? { tokens } : {}),
  };
}

/** Generate-table-definition resolvers */
export interface GenerateFlags {
  version?: string;
  force?: boolean;
  overlays?: {
    billingMode?: string;
    readCapacityUnits?: number | string;
    writeCapacityUnits?: number | string;
    tableName?: string;
  };
}
export function resolveGenerateAtVersion(
  flags: GenerateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): {
  version: string;
  cfg: VersionedLayoutConfig;
  options: {
    overlays?: {
      BillingMode?: string;
      ProvisionedThroughput?: {
        ReadCapacityUnits: number;
        WriteCapacityUnits: number;
      };
      TableName?: string;
    };
    force?: boolean;
  };
} {
  const cfg = resolveLayoutConfig({}, config, ref);
  const version =
    dotenvExpandLocal(
      firstDefined(flags.version, config?.generate?.version),
      ref,
    ) ?? '';
  const overlaysMerged = {
    ...(config?.generate?.overlays ?? {}),
    ...(flags.overlays ?? {}),
  };
  const overlaysExpanded = dotenvExpandAllLocal(overlaysMerged, ref);
  const BillingMode = overlaysExpanded.billingMode;
  const R = num(overlaysExpanded.readCapacityUnits);
  const W = num(overlaysExpanded.writeCapacityUnits);
  const TableName = overlaysExpanded.tableName;
  const options = {
    ...(BillingMode || R || W || TableName
      ? {
          overlays: {
            ...(BillingMode ? { BillingMode } : {}),
            ...(R !== undefined && W !== undefined
              ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: R,
                    WriteCapacityUnits: W,
                  },
                }
              : {}),
            ...(TableName ? { TableName } : {}),
          },
        }
      : {}),
    ...(firstDefined(flags.force, config?.generate?.force)
      ? { force: true }
      : {}),
  };
  return { version, cfg, options };
}

/** Validate-table-definition resolvers */
export interface ValidateFlags {
  version?: string;
}
export function resolveValidateAtVersion(
  flags: ValidateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { version: string; cfg: VersionedLayoutConfig } {
  const cfg = resolveLayoutConfig({}, config, ref);
  const version =
    dotenvExpandLocal(
      firstDefined(flags.version, config?.validate?.version),
      ref,
    ) ?? '';
  return { version, cfg };
}

/** Create-table resolvers */
export interface CreateFlags {
  version?: string;
  validate?: boolean;
  refreshGenerated?: boolean;
  force?: boolean;
  tableNameOverride?: string;
  maxSeconds?: number | string;
}
export function resolveCreateAtVersion(
  flags: CreateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): {
  version: string;
  cfg: VersionedLayoutConfig;
  options: {
    validate?: boolean;
    refreshGenerated?: boolean;
    force?: boolean;
    waiter?: WaiterConfig;
    tableNameOverride?: string;
  };
} {
  const cfg = resolveLayoutConfig({}, config, ref);
  const version =
    dotenvExpandLocal(
      firstDefined(flags.version, config?.create?.version),
      ref,
    ) ?? '';
  const tableNameOverride = dotenvExpandLocal(
    firstDefined(flags.tableNameOverride, config?.create?.tableNameOverride),
    ref,
  );
  const maxSeconds = num(
    firstDefined(flags.maxSeconds, config?.create?.waiter?.maxSeconds),
  );
  const options = {
    ...(firstDefined(flags.validate, config?.create?.validate) !== undefined
      ? { validate: !!firstDefined(flags.validate, config?.create?.validate) }
      : {}),
    ...(firstDefined(
      flags.refreshGenerated,
      config?.create?.refreshGenerated,
    ) !== undefined
      ? {
          refreshGenerated: !!firstDefined(
            flags.refreshGenerated,
            config?.create?.refreshGenerated,
          ),
        }
      : {}),
    ...(firstDefined(flags.force, config?.create?.force)
      ? { force: true }
      : {}),
    ...(maxSeconds !== undefined
      ? { waiter: { maxWaitTime: maxSeconds } as WaiterConfig }
      : {}),
    ...(tableNameOverride ? { tableNameOverride } : {}),
  };
  return { version, cfg, options };
}

/** Delete-table resolver */
export interface DeleteFlags {
  tableName?: string;
  maxSeconds?: number | string;
}
export function resolveDelete(
  flags: DeleteFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { options: { waiter?: WaiterConfig; tableNameOverride?: string } } {
  const tableNameOverride = dotenvExpandLocal(
    firstDefined(flags.tableName, config?.delete?.tableName),
    ref,
  );
  const maxSeconds = num(
    firstDefined(flags.maxSeconds, config?.delete?.waiter?.maxSeconds),
  );
  const options = {
    ...(tableNameOverride ? { tableNameOverride } : {}),
    ...(maxSeconds !== undefined
      ? { waiter: { maxWaitTime: maxSeconds } as WaiterConfig }
      : {}),
  };
  return { options };
}

/** Purge-table resolver */
export interface PurgeFlags {
  tableName?: string;
}
export function resolvePurge(
  flags: PurgeFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { options: { tableNameOverride?: string } } {
  const tableNameOverride = dotenvExpandLocal(
    firstDefined(flags.tableName, config?.purge?.tableName),
    ref,
  );
  return { options: { ...(tableNameOverride ? { tableNameOverride } : {}) } };
}

/** Migrate-data resolver */
export interface MigrateFlags {
  sourceTable?: string;
  targetTable?: string;
  fromVersion?: string;
  toVersion?: string;
  pageSize?: number | string;
  limit?: number | string;
  transformConcurrency?: number | string;
  progressIntervalMs?: number | string;
}
export function resolveMigrate(
  flags: MigrateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): {
  cfg: VersionedLayoutConfig;
  fromVersion: string;
  toVersion: string;
  sourceTableName?: string;
  targetTableName?: string;
  pageSize?: number;
  limit?: number;
  transformConcurrency?: number;
  progressIntervalMs?: number;
} {
  const cfg = resolveLayoutConfig({}, config, ref);
  const fromVersion =
    dotenvExpandLocal(
      firstDefined(flags.fromVersion, config?.migrate?.fromVersion),
      ref,
    ) ?? '';
  const toVersion =
    dotenvExpandLocal(
      firstDefined(flags.toVersion, config?.migrate?.toVersion),
      ref,
    ) ?? '';
  const sourceTableName = dotenvExpandLocal(
    firstDefined(flags.sourceTable, config?.migrate?.sourceTable),
    ref,
  );
  const targetTableName = dotenvExpandLocal(
    firstDefined(flags.targetTable, config?.migrate?.targetTable),
    ref,
  );
  const pageSize = num(firstDefined(flags.pageSize, config?.migrate?.pageSize));
  const limit = num(firstDefined(flags.limit, config?.migrate?.limit));
  const transformConcurrency = num(
    firstDefined(
      flags.transformConcurrency,
      config?.migrate?.transformConcurrency,
    ),
  );
  const progressIntervalMs = num(
    firstDefined(flags.progressIntervalMs, config?.migrate?.progressIntervalMs),
  );
  return {
    cfg,
    fromVersion,
    toVersion,
    ...(sourceTableName ? { sourceTableName } : {}),
    ...(targetTableName ? { targetTableName } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(transformConcurrency !== undefined ? { transformConcurrency } : {}),
    ...(progressIntervalMs !== undefined ? { progressIntervalMs } : {}),
  };
}
