import { dotenvExpand, interpolateDeep } from '@karmaniverous/get-dotenv';

import type { VersionedLayoutConfig } from '../../layout';
import { firstDefined, num } from './coerce';
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
    overlays?: {
      BillingMode?: string;
      ProvisionedThroughput?: {
        ReadCapacityUnits: number;
        WriteCapacityUnits: number;
      };
      TableName?: string;
    };
    force?: boolean;
  };
} {
  const cfg = resolveLayoutConfig({}, config, ref);
  const envRef = { ...process.env, ...ref };
  // Host interpolates config strings once; expand flags only.
  const version =
    dotenvExpand(flags.version, envRef) ?? config?.generate?.version ?? '';

  const overlaysExpandedFlags = flags.overlays
    ? interpolateDeep(flags.overlays, envRef)
    : undefined;
  const overlaysMerged = {
    ...(config?.generate?.overlays ?? {}),
    ...(overlaysExpandedFlags ?? {}),
  };

  const BillingMode = overlaysMerged.billingMode;
  const R = num(overlaysMerged.readCapacityUnits);
  const W = num(overlaysMerged.writeCapacityUnits);
  const TableName = overlaysMerged.tableName;
  const options = {
    ...(BillingMode || R !== undefined || W !== undefined || TableName
      ? {
          overlays: {
            ...(BillingMode ? { BillingMode } : {}),
            ...(R !== undefined && W !== undefined
              ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: R,
                    WriteCapacityUnits: W,
                  },
                }
              : {}),
            ...(TableName ? { TableName } : {}),
          },
        }
      : {}),
    ...(firstDefined(flags.force, config?.generate?.force)
      ? { force: true }
      : {}),
  };
  return { version, cfg, options };
}
