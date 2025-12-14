import type { VersionedLayoutConfig } from '../../layout';
import { dotenvExpandLocal, firstDefined, num } from './expand';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef } from './types';

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
  // Host interpolates config strings once; expand flags only.
  const fromVersion =
    dotenvExpandLocal(flags.fromVersion, ref) ??
    config?.migrate?.fromVersion ??
    '';
  const toVersion =
    dotenvExpandLocal(flags.toVersion, ref) ?? config?.migrate?.toVersion ?? '';
  const sourceTableName =
    dotenvExpandLocal(flags.sourceTable, ref) ?? config?.migrate?.sourceTable;
  const targetTableName =
    dotenvExpandLocal(flags.targetTable, ref) ?? config?.migrate?.targetTable;
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
