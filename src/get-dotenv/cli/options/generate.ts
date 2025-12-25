import { dotenvExpand, interpolateDeep } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { firstDefined } from './coerce';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef, GenerateFlags } from './types';

/**
 * Resolve CLI flags + plugin config into generate-table-definition inputs.
 *
 * Expansion policy:
 * - Config strings are already interpolated by the host (do not re-expand).
 * - Runtime flags are expanded once using get-dotenv's `dotenvExpand` / `interpolateDeep`.
 * - Expansion reference is `{ ...process.env, ...ref }` (ctx wins).
 *
 * @param flags - Parsed CLI flags.
 * @param config - Plugin config slice (already interpolated by host).
 * @param ref - Env reference (typically ctx.dotenv).
 * @returns Resolved version, layout config, and generation options.
 */
export function resolveGenerateAtVersion(
  flags: GenerateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): {
  version: string;
  cfg: VersionedLayoutConfig;
  options: {
    clean?: boolean;
    tableProperties?: {
      billingMode?: string;
      readCapacityUnits?: number | string;
      writeCapacityUnits?: number | string;
      tableName?: string;
    };
  };
} {
  const cfg = resolveLayoutConfig({}, config, ref);
  const envRef = { ...process.env, ...ref };
  // Host interpolates config strings once; expand flags only.
  const version =
    dotenvExpand(flags.version, envRef) ?? config?.generate?.version ?? '';
  if (!version.trim()) {
    throw new Error(
      'generate version is required (set --version or configure plugins["aws/dynamodb"].generate.version)',
    );
  }

  const flagsTablePropsExpanded = flags.tableProperties
    ? interpolateDeep(flags.tableProperties, envRef)
    : undefined;
  const tableProperties = {
    ...(config?.generate?.tableProperties ?? {}),
    ...(flagsTablePropsExpanded ?? {}),
  };

  const clean = firstDefined(flags.clean, config?.generate?.clean);

  const options = {
    ...(clean ? { clean: true } : {}),
    ...(Object.keys(tableProperties).length
      ? { tableProperties: tableProperties as never }
      : {}),
  };
  return { version, cfg, options };
}
