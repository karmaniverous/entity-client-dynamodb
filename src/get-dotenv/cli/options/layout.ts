import type { VersionedLayoutConfig } from '../../layout';
import { dotenvExpandAllLocal, dotenvExpandLocal } from './expand';
import type { DynamodbPluginConfig, EnvRef } from './types';

/** Build VersionedLayoutConfig from flags+config with dotenv expansion. */
export function resolveLayoutConfig(
  flags: { tablesPath?: string; tokens?: DynamodbPluginConfig['tokens'] },
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): VersionedLayoutConfig {
  // Host interpolates config strings once before plugin execution.
  // We only expand runtime flags to avoid double-expansion.
  const tablesPath =
    dotenvExpandLocal(flags.tablesPath, ref) ?? config?.tablesPath;

  const mergedTokens: Record<string, unknown> = {
    ...(config?.tokens ?? {}),
    ...(flags.tokens ? dotenvExpandAllLocal(flags.tokens, ref) : {}),
  };
  const tokens =
    Object.keys(mergedTokens).length > 0
      ? (mergedTokens as VersionedLayoutConfig['tokens'])
      : undefined;
  return {
    ...(tablesPath ? { tablesPath } : {}),
    ...(tokens ? { tokens } : {}),
  };
}
