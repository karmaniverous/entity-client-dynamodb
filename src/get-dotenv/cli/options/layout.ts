import type { VersionedLayoutConfig } from '../../layout';
import {
  dotenvExpandAllLocal,
  dotenvExpandLocal,
  firstDefined,
} from './expand';
import type { DynamodbPluginConfig, EnvRef } from './types';

/** Build VersionedLayoutConfig from flags+config with dotenv expansion. */
export function resolveLayoutConfig(
  flags: { tablesPath?: string; tokens?: DynamodbPluginConfig['tokens'] },
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): VersionedLayoutConfig {
  const tablesPath = dotenvExpandLocal(
    firstDefined(flags.tablesPath, config?.tablesPath),
    ref,
  );
  const mergedTokens = {
    ...(config?.tokens ?? {}),
    ...(flags.tokens ?? {}),
  };
  const tokens =
    Object.keys(mergedTokens).length > 0
      ? (dotenvExpandAllLocal(
          mergedTokens,
          ref,
        ) as VersionedLayoutConfig['tokens'])
      : undefined;
  return {
    ...(tablesPath ? { tablesPath } : {}),
    ...(tokens ? { tokens } : {}),
  };
}
