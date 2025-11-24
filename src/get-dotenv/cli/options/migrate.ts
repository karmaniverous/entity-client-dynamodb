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
