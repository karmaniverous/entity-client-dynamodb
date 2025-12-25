import { dotenvExpand, interpolateDeep } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { num } from './coerce';
import type { DynamodbPluginConfig, EnvRef } from './types';

/** Build VersionedLayoutConfig from flags+config with dotenv expansion. */
/**
 * Build VersionedLayoutConfig from flags+config with dotenv expansion.
 *
 * Expansion policy:
 * - Config strings are already interpolated by the host (do not re-expand).
 * - Runtime flags are expanded once using get-dotenv's `dotenvExpand` / `interpolateDeep`.
 * - Expansion reference is `{ ...process.env, ...ref }` (ctx wins).
 *
 * @param flags - CLI flags relevant to layout.
 * @param config - Plugin config slice (already interpolated by host).
 * @param ref - Env reference (typically ctx.dotenv).
 * @returns VersionedLayoutConfig for path/token resolution.
 */
export function resolveLayoutConfig(
  flags: { tablesPath?: string; tokens?: DynamodbPluginConfig['tokens'] },
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): VersionedLayoutConfig {
  const envRef = { ...process.env, ...ref };
  // Host interpolates config strings once before plugin execution.
  // We only expand runtime flags to avoid double-expansion.
  const tablesPath =
    dotenvExpand(flags.tablesPath, envRef) ?? config?.tablesPath;

  const minWidthRaw = config?.minTableVersionWidth;
  const minWidth = num(minWidthRaw);
  if (
    minWidth !== undefined &&
    (!Number.isInteger(minWidth) || minWidth <= 0)
  ) {
    throw new Error('minTableVersionWidth must be a positive integer');
  }

  const tokensFromFlags = flags.tokens
    ? (interpolateDeep(flags.tokens, envRef) as DynamodbPluginConfig['tokens'])
    : undefined;
  const mergedTokens: Record<string, unknown> = {
    ...(config?.tokens ?? {}),
    ...(tokensFromFlags ?? {}),
  };
  const tokens =
    Object.keys(mergedTokens).length > 0
      ? (mergedTokens as VersionedLayoutConfig['tokens'])
      : undefined;
  return {
    ...(tablesPath ? { tablesPath } : {}),
    ...(minWidth !== undefined ? { minTableVersionWidth: minWidth } : {}),
    ...(tokens ? { tokens } : {}),
  };
}
