import type { VersionedLayoutConfig } from '../../layout';
import {
  dotenvExpandAllLocal,
  dotenvExpandLocal,
  firstDefined,
  num,
} from './expand';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef, GenerateFlags } from './types';

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
  // Host interpolates config strings once; expand flags only.
  const version =
    dotenvExpandLocal(flags.version, ref) ?? config?.generate?.version ?? '';

  const overlaysExpandedFlags = flags.overlays
    ? dotenvExpandAllLocal(flags.overlays, ref)
    : {};
  const overlaysMerged = {
    ...(config?.generate?.overlays ?? {}),
    ...overlaysExpandedFlags,
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
