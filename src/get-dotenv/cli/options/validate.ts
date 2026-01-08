import { dotenvExpand, type ProcessEnv } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, ValidateFlags } from './types';

/**
 * Fully resolved inputs for a `validate` operation at a specific version.
 *
 * @category get-dotenv
 */
export interface ResolvedValidateAtVersion {
  /** Target version token (NNN). */
  version: string;
  /** Versioned layout config. */
  cfg: VersionedLayoutConfig;
}

/**
 * Resolve CLI flags + plugin config into validate-table-definition inputs.
 *
 * Expansion policy:
 * - Config strings are already interpolated by the host (do not re-expand).
 * - Runtime flags are expanded once using get-dotenv's `dotenvExpand`.
 * - Expansion reference is `{ ...process.env, ...ref }` (ctx wins).
 *
 * @param flags - Parsed CLI flags.
 * @param config - Plugin config slice (already interpolated by host).
 * @param ref - Env reference (typically ctx.dotenv).
 * @returns Resolved version and layout config.
 */
export function resolveValidateAtVersion(
  flags: ValidateFlags,
  config?: DynamodbPluginConfig,
  ref: ProcessEnv = process.env,
): ResolvedValidateAtVersion {
  const cfg = resolveLayoutConfig({}, config, ref);
  // Host interpolates config strings once; expand flags only.
  const envRef = { ...process.env, ...ref };
  const version =
    dotenvExpand(flags.version, envRef) ?? config?.validate?.version ?? '';
  if (!version.trim()) {
    throw new Error(
      'validate version is required (set --version or configure plugins["aws/dynamodb"].validate.version)',
    );
  }
  return { version, cfg };
}
