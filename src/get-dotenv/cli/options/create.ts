import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { WaiterConfig } from '../../../EntityClient/WaiterConfig';
import type { VersionedLayoutConfig } from '../../layout';
import { firstDefined, num } from './coerce';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef } from './types';

/**
 * Raw CLI flags for `create` (before merge/expansion/coercion).
 *
 * @category get-dotenv
 */
export interface CreateFlags {
  /** Target version (NNN). */
  version?: string;
  /** Validate YAML drift before creating (defaults to config / true). */
  validate?: boolean;
  /** Refresh generated YAML sections before creating (default false). */
  refreshGenerated?: boolean;
  /** Proceed on drift when validation fails (default false). */
  force?: boolean;
  /** Allow creating a non-latest version (unsafe; default false). */
  allowNonLatest?: boolean;
  /** One-off TableName override for the create call (does not persist to YAML). */
  tableNameOverride?: string;
  /** Waiter max seconds override (number or string; dotenv expanded). */
  maxSeconds?: number | string;
}

/**
 * Resolved `create` options passed to {@link createTableAtVersion | `createTableAtVersion`}.
 *
 * @category get-dotenv
 */
export interface CreateAtVersionOptions {
  /** Validate drift before create (default true). */
  validate?: boolean;
  /** Refresh generated sections before create (default false). */
  refreshGenerated?: boolean;
  /** Force create even if drift is detected (only applies when validate is true). */
  force?: boolean;
  /** Allow creating a non-latest version (unsafe). */
  allowNonLatest?: boolean;
  /** Optional waiter config (maxWaitTime seconds). */
  waiter?: WaiterConfig;
  /** Optional one-off TableName override. */
  tableNameOverride?: string;
}

/**
 * Fully resolved inputs for a `create` operation at a specific version.
 *
 * @category get-dotenv
 */
export interface ResolvedCreateAtVersion {
  /** Target version token (NNN). */
  version: string;
  /** Versioned layout config (tablesPath/tokens/width). */
  cfg: VersionedLayoutConfig;
  /** Options for create flow. */
  options: CreateAtVersionOptions;
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
): ResolvedCreateAtVersion {
  const cfg = resolveLayoutConfig({}, config, ref);
  const envRef = { ...process.env, ...ref };

  // Host interpolates config strings once; expand flags only.
  const version =
    dotenvExpand(flags.version, envRef) ?? config?.create?.version ?? '';
  if (!version.trim()) {
    throw new Error(
      'create version is required (set --version or configure plugins["aws/dynamodb"].create.version)',
    );
  }
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

  const options: CreateAtVersionOptions = {
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
