import { dotenvExpand } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef, ValidateFlags } from './types';

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
  ref: EnvRef = process.env,
): { version: string; cfg: VersionedLayoutConfig } {
  const cfg = resolveLayoutConfig({}, config, ref);
  // Host interpolates config strings once; expand flags only.
  const envRef = { ...process.env, ...ref };
  const version =
    dotenvExpand(flags.version, envRef) ?? config?.validate?.version ?? '';
  return { version, cfg };
}
