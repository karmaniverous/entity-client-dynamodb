import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { DynamodbPluginConfig, EnvRef } from './types';

export interface PurgeFlags {
  tableName?: string;
}

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
): { options: { tableNameOverride?: string } } {
  // Host interpolates config strings once; expand flags only.
  const envRef = { ...process.env, ...ref };
  const tableNameOverride =
    dotenvExpand(flags.tableName, envRef) ?? config?.purge?.tableName;
  return { options: { ...(tableNameOverride ? { tableNameOverride } : {}) } };
}
