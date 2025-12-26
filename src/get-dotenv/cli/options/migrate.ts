import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { firstDefined, num } from './coerce';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef } from './types';

/**
 * Raw CLI flags for `migrate` (before merge/expansion/coercion).
 *
 * @category get-dotenv
 */
export interface MigrateFlags {
  /** Source table name (dotenv expanded). */
  sourceTable?: string;
  /** Target table name (dotenv expanded). */
  targetTable?: string;
  /** From version token (NNN; exclusive). */
  fromVersion?: string;
  /** To version token (NNN; inclusive). */
  toVersion?: string;
  /** Scan page size (number or string; dotenv expanded). */
  pageSize?: number | string;
  /** Max outputs to write (number or string; dotenv expanded). */
  limit?: number | string;
  /** Transform concurrency (number or string; dotenv expanded). */
  transformConcurrency?: number | string;
  /** Progress tick interval ms (number or string; dotenv expanded). */
  progressIntervalMs?: number | string;
}

/**
 * Resolved migrate settings.
 *
 * @category get-dotenv
 */
export interface ResolvedMigrate {
  /** Versioned layout config. */
  cfg: VersionedLayoutConfig;
  /** From version token (exclusive). */
  fromVersion: string;
  /** To version token (inclusive). */
  toVersion: string;
  /** Optional resolved source table name override. */
  sourceTableName?: string;
  /** Optional resolved target table name override. */
  targetTableName?: string;
  /** Optional scan page size. */
  pageSize?: number;
  /** Optional max outputs to write. */
  limit?: number;
  /** Optional transform concurrency. */
  transformConcurrency?: number;
  /** Optional progress tick interval ms. */
  progressIntervalMs?: number;
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
): ResolvedMigrate {
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

  if (!fromVersion.trim()) {
    throw new Error(
      'migrate fromVersion is required (set --from-version or configure plugins["aws/dynamodb"].migrate.fromVersion)',
    );
  }
  if (!toVersion.trim()) {
    throw new Error(
      'migrate toVersion is required (set --to-version or configure plugins["aws/dynamodb"].migrate.toVersion)',
    );
  }

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
