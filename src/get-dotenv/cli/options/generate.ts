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
  const version =
    dotenvExpandLocal(
      firstDefined(flags.version, config?.generate?.version),
      ref,
    ) ?? '';
  const overlaysMerged = {
    ...(config?.generate?.overlays ?? {}),
    ...(flags.overlays ?? {}),
  };
  const overlaysExpanded = dotenvExpandAllLocal(overlaysMerged, ref);
  const BillingMode = overlaysExpanded.billingMode;
  const R = num(overlaysExpanded.readCapacityUnits);
  const W = num(overlaysExpanded.writeCapacityUnits);
  const TableName = overlaysExpanded.tableName;
  const options = {
    ...(BillingMode || R || W || TableName
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
