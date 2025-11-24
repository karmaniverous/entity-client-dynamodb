import type { VersionedLayoutConfig } from '../../layout';
import { dotenvExpandLocal, firstDefined } from './expand';
import { resolveLayoutConfig } from './layout';
import type { DynamodbPluginConfig, EnvRef, ValidateFlags } from './types';

export function resolveValidateAtVersion(
  flags: ValidateFlags,
  config?: DynamodbPluginConfig,
  ref: EnvRef = process.env,
): { version: string; cfg: VersionedLayoutConfig } {
  const cfg = resolveLayoutConfig({}, config, ref);
  const version =
    dotenvExpandLocal(
      firstDefined(flags.version, config?.validate?.version),
      ref,
    ) ?? '';
  return { version, cfg };
}
