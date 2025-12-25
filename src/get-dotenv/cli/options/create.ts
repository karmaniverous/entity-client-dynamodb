import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { WaiterConfig } from '../../../EntityClient/WaiterConfig';
import type { VersionedLayoutConfig } from '../../layout';
import { firstDefined, num } from './coerce';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef } from './types';

export interface CreateFlags {
  version?: string;
  validate?: boolean;
  refreshGenerated?: boolean;
  force?: boolean;
  allowNonLatest?: boolean;
  tableNameOverride?: string;
  maxSeconds?: number | string;
}

/**
 * Resolve CLI flags + plugin config into create-table inputs for a specific version.
 *
 * Expansion policy:
 * - Config strings are already interpolated by the host (do not re-expand).
 * - Runtime flags are expanded once using get-dotenv's `dotenvExpand`.
 * - Expansion reference is `{ ...process.env, ...ref }` (ctx wins).
 *
 * @param flags - Parsed CLI flags.
 * @param config - Plugin config slice (already interpolated by host).
 * @param ref - Env reference (typically ctx.dotenv).
 * @returns Resolved version, layout config, and create options.
 */
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
    allowNonLatest?: boolean;
    waiter?: WaiterConfig;
    tableNameOverride?: string;
  };
} {
  const cfg = resolveLayoutConfig({}, config, ref);
  const envRef = { ...process.env, ...ref };

  // Host interpolates config strings once; expand flags only.
  const version =
    dotenvExpand(flags.version, envRef) ?? config?.create?.version ?? '';
  const tableNameOverride =
    dotenvExpand(flags.tableNameOverride, envRef) ??
    config?.create?.tableNameOverride;

  const maxSecondsRaw = firstDefined(
    flags.maxSeconds,
    config?.create?.waiter?.maxSeconds,
  );
  const maxSecondsExpanded =
    typeof maxSecondsRaw === 'string'
      ? (dotenvExpand(maxSecondsRaw, envRef) ?? maxSecondsRaw)
      : maxSecondsRaw;
  const maxSeconds = num(maxSecondsExpanded);

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
    ...(flags.allowNonLatest ? { allowNonLatest: true } : {}),
    ...(maxSeconds !== undefined
      ? { waiter: { maxWaitTime: maxSeconds } as WaiterConfig }
      : {}),
    ...(tableNameOverride ? { tableNameOverride } : {}),
  };
  return { version, cfg, options };
}
