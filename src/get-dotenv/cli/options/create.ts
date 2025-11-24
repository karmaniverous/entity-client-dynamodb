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
  const version =
    dotenvExpandLocal(
      firstDefined(flags.version, config?.create?.version),
      ref,
    ) ?? '';
  const tableNameOverride = dotenvExpandLocal(
    firstDefined(flags.tableNameOverride, config?.create?.tableNameOverride),
    ref,
  );
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
