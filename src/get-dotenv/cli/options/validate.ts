import type { VersionedLayoutConfig } from '../../layout';
import { dotenvExpandLocal } from './expand';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef, ValidateFlags } from './types';

export function resolveValidateAtVersion(
  flags: ValidateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { version: string; cfg: VersionedLayoutConfig } {
  const cfg = resolveLayoutConfig({}, config, ref);
  // Host interpolates config strings once; expand flags only.
  const version =
    dotenvExpandLocal(flags.version, ref) ?? config?.validate?.version ?? '';
  return { version, cfg };
}
