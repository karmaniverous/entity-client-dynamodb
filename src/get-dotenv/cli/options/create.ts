import type { WaiterConfig } from '../../../EntityClient/WaiterConfig';
import type { VersionedLayoutConfig } from '../../layout';
import { dotenvExpandLocal, firstDefined, num } from './expand';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef } from './types';

export interface CreateFlags {
  version?: string;
  validate?: boolean;
  refreshGenerated?: boolean;
  force?: boolean;
  tableNameOverride?: string;
  maxSeconds?: number | string;
}

export function resolveCreateAtVersion(
  flags: CreateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): {
  version: string;
  cfg: VersionedLayoutConfig;
  options: {
    validate?: boolean;
    refreshGenerated?: boolean;
    force?: boolean;
    waiter?: WaiterConfig;
    tableNameOverride?: string;
  };
} {
  const cfg = resolveLayoutConfig({}, config, ref);
  // Host interpolates config strings once; expand flags only.
  const version =
    dotenvExpandLocal(flags.version, ref) ?? config?.create?.version ?? '';
  const tableNameOverride =
    dotenvExpandLocal(flags.tableNameOverride, ref) ??
    config?.create?.tableNameOverride;
  const maxSeconds = num(
    firstDefined(flags.maxSeconds, config?.create?.waiter?.maxSeconds),
  );
  const options = {
    ...(firstDefined(flags.validate, config?.create?.validate) !== undefined
      ? { validate: !!firstDefined(flags.validate, config?.create?.validate) }
      : {}),
    ...(firstDefined(
      flags.refreshGenerated,
      config?.create?.refreshGenerated,
    ) !== undefined
      ? {
          refreshGenerated: !!firstDefined(
            flags.refreshGenerated,
            config?.create?.refreshGenerated,
          ),
        }
      : {}),
    ...(firstDefined(flags.force, config?.create?.force)
      ? { force: true }
      : {}),
    ...(maxSeconds !== undefined
      ? { waiter: { maxWaitTime: maxSeconds } as WaiterConfig }
      : {}),
    ...(tableNameOverride ? { tableNameOverride } : {}),
  };
  return { version, cfg, options };
}
