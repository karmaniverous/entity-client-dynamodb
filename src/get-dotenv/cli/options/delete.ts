import type { WaiterConfig } from '../../../EntityClient/WaiterConfig';
import { dotenvExpandLocal, firstDefined, num } from './expand';
import type { DynamodbPluginConfig, EnvRef } from './types';

export interface DeleteFlags {
  tableName?: string;
  maxSeconds?: number | string;
}

export function resolveDelete(
  flags: DeleteFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { options: { waiter?: WaiterConfig; tableNameOverride?: string } } {
  // Host interpolates config strings once; expand flags only.
  const tableNameOverride =
    dotenvExpandLocal(flags.tableName, ref) ?? config?.delete?.tableName;
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
