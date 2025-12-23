import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { WaiterConfig } from '../../../EntityClient/WaiterConfig';
import { firstDefined, num } from './coerce';
import type { DynamodbPluginConfig, EnvRef } from './types';

export interface DeleteFlags {
  tableName?: string;
  maxSeconds?: number | string;
}

/**
 * Resolve CLI flags + plugin config into delete-table options.
 *
 * Expansion policy:
 * - Config strings are already interpolated by the host (do not re-expand).
 * - Runtime flags are expanded once using get-dotenv's `dotenvExpand`.
 * - Expansion reference is `{ ...process.env, ...ref }` (ctx wins).
 *
 * @param flags - Parsed CLI flags.
 * @param config - Plugin config slice (already interpolated by host).
 * @param ref - Env reference (typically ctx.dotenv).
 * @returns Delete-table options (tableNameOverride, waiter).
 */
export function resolveDelete(
  flags: DeleteFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { options: { waiter?: WaiterConfig; tableNameOverride?: string } } {
  const envRef = { ...process.env, ...ref };
  // Host interpolates config strings once; expand flags only.
  const tableNameOverride =
    dotenvExpand(flags.tableName, envRef) ?? config?.delete?.tableName;

  const maxSecondsRaw = firstDefined(
    flags.maxSeconds,
    config?.delete?.waiter?.maxSeconds,
  );
  const maxSecondsExpanded =
    typeof maxSecondsRaw === 'string'
      ? (dotenvExpand(maxSecondsRaw, envRef) ?? maxSecondsRaw)
      : maxSecondsRaw;
  const maxSeconds = num(maxSecondsExpanded);

  const options = {
    ...(tableNameOverride ? { tableNameOverride } : {}),
    ...(maxSeconds !== undefined
      ? { waiter: { maxWaitTime: maxSeconds } as WaiterConfig }
      : {}),
  };
  return { options };
}
