import type { GetDotenvOptions } from '@karmaniverous/get-dotenv';
import type { PluginWithInstanceHelpers } from '@karmaniverous/get-dotenv/cliHost';

import type { DynamodbPluginConfig } from '../options';

/**
 * Typed DynamoDB plugin instance seam (aws-pattern).
 *
 * Ensures `plugin.readConfig(cli)` is strongly typed as {@link DynamodbPluginConfig | `DynamodbPluginConfig`}
 * in all command registration modules.
 */
export type DynamodbPluginInstance = PluginWithInstanceHelpers<
  GetDotenvOptions,
  DynamodbPluginConfig
>;
