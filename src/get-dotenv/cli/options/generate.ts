import { dotenvExpand, interpolateDeep } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { firstDefined } from './coerce';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef, GenerateFlags } from './types';

/** Managed table properties flags (generate). */
export interface GenerateTablePropertiesFlags {
  /** Billing mode (e.g. `PAY_PER_REQUEST` or `PROVISIONED`). */
  billingMode?: string;
  /** Provisioned RCU (requires billingMode=PROVISIONED). */
  readCapacityUnits?: number | string;
  /** Provisioned WCU (requires billingMode=PROVISIONED). */
  writeCapacityUnits?: number | string;
  /** Managed `Properties.TableName`. */
  tableName?: string;
}

/**
 * Resolved options for {@link generateTableDefinitionAtVersion | `generateTableDefinitionAtVersion`}.
 *
 * @category get-dotenv
 */
export interface GenerateAtVersionOptions {
  /** When true, recompose from baseline template + generated + managed properties. */
  clean?: boolean;
  /** Optional managed table properties to apply on generate/refresh. */
  tableProperties?: GenerateTablePropertiesFlags;
}

/**
 * Fully resolved inputs for a `generate` operation at a specific version.
 *
 * @category get-dotenv
 */
export interface ResolvedGenerateAtVersion {
  /** Target version token (NNN). */
  version: string;
  /** Versioned layout config. */
  cfg: VersionedLayoutConfig;
  /** Generate options (clean/tableProperties). */
  options: GenerateAtVersionOptions;
}

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
): ResolvedGenerateAtVersion {
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
  const tableProperties: GenerateTablePropertiesFlags = {
    ...(config?.generate?.tableProperties ?? {}),
    ...(flagsTablePropsExpanded ?? {}),
  };

  const clean = firstDefined(flags.clean, config?.generate?.clean);

  const options: GenerateAtVersionOptions = {
    ...(clean ? { clean: true } : {}),
    ...(Object.keys(tableProperties).length
      ? { tableProperties: tableProperties as never }
      : {}),
  };
  return { version, cfg, options };
}
