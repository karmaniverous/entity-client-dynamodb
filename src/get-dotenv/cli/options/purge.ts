import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { DynamodbPluginConfig, EnvRef } from './types';

/**
 * Raw CLI flags for `purge` (before merge/expansion).
 *
 * @category get-dotenv
 */
export interface PurgeFlags {
  /** Table name (dotenv expanded). */
  tableName?: string;
}

/**
 * Resolved options for {@link purgeTable | `purgeTable`}.
 *
 * @category get-dotenv
 */
export interface PurgeResolvedOptions {
  /** Optional one-off TableName override. */
  tableNameOverride?: string;
}

/**
 * Result returned by {@link resolvePurge | `resolvePurge`}.
 *
 * @category get-dotenv
 */
export type ResolvePurgeResult = {
  /** Resolved options for purge-table. */
  options: PurgeResolvedOptions;
};

/**
 * Resolve CLI flags + plugin config into purge-table options.
 *
 * Expansion policy:
 * - Config strings are already interpolated by the host (do not re-expand).
 * - Runtime flags are expanded once using get-dotenv's `dotenvExpand`.
 * - Expansion reference is `{ ...process.env, ...ref }` (ctx wins).
 *
 * @param flags - Parsed CLI flags.
 * @param config - Plugin config slice (already interpolated by host).
 * @param ref - Env reference (typically ctx.dotenv).
 * @returns Purge-table options (tableNameOverride).
 */
export function resolvePurge(
  flags: PurgeFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): ResolvePurgeResult {
  // Host interpolates config strings once; expand flags only.
  const envRef = { ...process.env, ...ref };
  const tableNameOverride =
    dotenvExpand(flags.tableName, envRef) ?? config?.purge?.tableName;
  return {
    options: { ...(tableNameOverride ? { tableNameOverride } : {}) },
  };
}
