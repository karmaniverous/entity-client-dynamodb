import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { firstDefined, num } from './coerce';
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

/**
 * Resolve CLI flags + plugin config into migrate-data inputs.
 *
 * Expansion policy:
 * - Config strings are already interpolated by the host (do not re-expand).
 * - Runtime flags are expanded once using get-dotenv's `dotenvExpand`.
 * - Expansion reference is `{ ...process.env, ...ref }` (ctx wins).
 *
 * @param flags - Parsed CLI flags.
 * @param config - Plugin config slice (already interpolated by host).
 * @param ref - Env reference (typically ctx.dotenv).
 * @returns Resolved migrate-data settings.
 */
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
  const envRef = { ...process.env, ...ref };
  // Host interpolates config strings once; expand flags only.
  const fromVersion =
    dotenvExpand(flags.fromVersion, envRef) ??
    config?.migrate?.fromVersion ??
    '';
  const toVersion =
    dotenvExpand(flags.toVersion, envRef) ?? config?.migrate?.toVersion ?? '';
  const sourceTableName =
    dotenvExpand(flags.sourceTable, envRef) ?? config?.migrate?.sourceTable;
  const targetTableName =
    dotenvExpand(flags.targetTable, envRef) ?? config?.migrate?.targetTable;

  const pageSizeRaw = firstDefined(flags.pageSize, config?.migrate?.pageSize);
  const pageSizeExpanded =
    typeof pageSizeRaw === 'string'
      ? (dotenvExpand(pageSizeRaw, envRef) ?? pageSizeRaw)
      : pageSizeRaw;
  const pageSize = num(pageSizeExpanded);

  const limitRaw = firstDefined(flags.limit, config?.migrate?.limit);
  const limitExpanded =
    typeof limitRaw === 'string'
      ? (dotenvExpand(limitRaw, envRef) ?? limitRaw)
      : limitRaw;
  const limit = num(limitExpanded);

  const transformConcurrencyRaw = firstDefined(
    flags.transformConcurrency,
    config?.migrate?.transformConcurrency,
  );
  const transformConcurrencyExpanded =
    typeof transformConcurrencyRaw === 'string'
      ? (dotenvExpand(transformConcurrencyRaw, envRef) ??
        transformConcurrencyRaw)
      : transformConcurrencyRaw;
  const transformConcurrency = num(transformConcurrencyExpanded);

  const progressIntervalMsRaw = firstDefined(
    flags.progressIntervalMs,
    config?.migrate?.progressIntervalMs,
  );
  const progressIntervalMsExpanded =
    typeof progressIntervalMsRaw === 'string'
      ? (dotenvExpand(progressIntervalMsRaw, envRef) ?? progressIntervalMsRaw)
      : progressIntervalMsRaw;
  const progressIntervalMs = num(progressIntervalMsExpanded);

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
