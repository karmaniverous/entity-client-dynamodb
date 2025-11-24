import { dotenvExpandLocal, firstDefined } from './expand';
import type { DynamodbPluginConfig, EnvRef } from './types';

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
