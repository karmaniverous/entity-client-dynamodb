import { dotenvExpandLocal } from './expand';
import type { DynamodbPluginConfig, EnvRef } from './types';

export interface PurgeFlags {
  tableName?: string;
}

export function resolvePurge(
  flags: PurgeFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { options: { tableNameOverride?: string } } {
  // Host interpolates config strings once; expand flags only.
  const tableNameOverride =
    dotenvExpandLocal(flags.tableName, ref) ?? config?.purge?.tableName;
  return { options: { ...(tableNameOverride ? { tableNameOverride } : {}) } };
}
