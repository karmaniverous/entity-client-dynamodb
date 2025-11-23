/**
 * get-dotenv "dynamodb" plugin (host-aware).
 *
 * Uses the public CLI host seam from \@karmaniverous/get-dotenv/cliHost:
 * - definePlugin: to declare a composable plugin
 * - GetDotenvCliPublic: structural host interface for setup/ctx access
 *
 * Currently implements:
 * - dynamodb generate  (author/refresh tables/NNN/table.yml)
 * - dynamodb validate  (validate generated sections vs EM output)
 *
 * Notes:
 * - Option precedence and dotenv expansion are handled via resolvers in
 *   ./options.ts. We thread ctx.dotenv for expansion and merge plugin config
 *   from ctx.pluginConfigs?.dynamodb.
 * - Layout tokens (tablesPath/tokens.{table,entityManager,transform}) can be
 *   overridden by flags and merged with config.
 * - EM resolution uses fallback via resolveAndLoadEntityManager.
 */

import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import {
  definePlugin,
  type GetDotenvCliPublic,
} from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../emLoader';
import { generateTableDefinitionAtVersion } from '../services/generate';
import { validateTableDefinitionAtVersion } from '../services/validateTable';
import {
  type DynamodbPluginConfig,
  resolveGenerateAtVersion,
  resolveLayoutConfig,
  resolveValidateAtVersion,
} from './options';

function getPluginConfig(cli: GetDotenvCliPublic): DynamodbPluginConfig {
  // Best-effort: the host populates ctx.pluginConfigs keyed by plugin.id
  const cfg = cli.getCtx()?.pluginConfigs?.dynamodb;
  return (cfg ?? {}) as DynamodbPluginConfig;
}

export const dynamodbPlugin = definePlugin({
  id: 'dynamodb',
  setup: (cli) => {
    // Group namespace
    const group = cli
      .ns('dynamodb')
      .description('DynamoDB utilities (versioned table defs + validation)');

    // generate: compose/refresh tables/NNN/table.yml
    group
      .command('generate')
      .description(
        'Compose or refresh tables/NNN/table.yml (comment-preserving)',
      )
      // Version/layout flags
      .option('--version <string>', 'target version (NNN; dotenv-expanded)')
      .option('--tables-path <string>', 'tables root (dotenv-expanded)')
      .option('--token-table <string>', 'token (table) filename without ext')
      .option(
        '--token-entity-manager <string>',
        'token (entityManager) filename without ext',
      )
      .option(
        '--token-transform <string>',
        'token (transform) filename without ext',
      )
      // Overlays
      .option(
        '--overlay-billing-mode <string>',
        'BillingMode overlay (e.g., PAY_PER_REQUEST)',
      )
      .option(
        '--overlay-rcu <number>',
        'ProvisionedThroughput.ReadCapacityUnits',
      )
      .option(
        '--overlay-wcu <number>',
        'ProvisionedThroughput.WriteCapacityUnits',
      )
      .option('--overlay-table-name <string>', 'TableName overlay (one-off)')
      // Behavior
      .option(
        '--force',
        'force compose (create new) even if file exists (otherwise refresh)',
        false,
      )
      .action(async (flags: Record<string, unknown>) => {
        const ctx = cli.getCtx();
        const envRef = ctx?.dotenv ?? process.env;
        const pluginCfg = getPluginConfig(cli);

        // Layout config precedence: flags > plugins.dynamodb > defaults
        const cfg = resolveLayoutConfig(
          {
            tablesPath: flags.tablesPath as string | undefined,
            tokens: {
              table: flags.tokenTable as string | undefined,
              entityManager: flags.tokenEntityManager as string | undefined,
              transform: flags.tokenTransform as string | undefined,
            },
          },
          pluginCfg,
          envRef,
        );

        // Version + overlays (flags > config > defaults)
        const gen = resolveGenerateAtVersion(
          {
            version: flags.version as string | undefined,
            force: !!flags.force,
            overlays: {
              billingMode: flags.overlayBillingMode as string | undefined,
              readCapacityUnits: flags.overlayRcu as
                | number
                | string
                | undefined,
              writeCapacityUnits: flags.overlayWcu as
                | number
                | string
                | undefined,
              tableName: flags.overlayTableName as string | undefined,
            },
          },
          pluginCfg,
          envRef,
        );

        // Load EM with fallback then generate/refresh YAML.
        const em = await resolveAndLoadEntityManager(gen.version, cfg);

        // Narrow overlay types to CreateTableCommandInput where needed
        const overlaysSafe: {
          BillingMode?: CreateTableCommandInput['BillingMode'];
          ProvisionedThroughput?: {
            ReadCapacityUnits: number;
            WriteCapacityUnits: number;
          };
          TableName?: string;
        } = {};
        if (gen.options.overlays?.BillingMode) {
          overlaysSafe.BillingMode = gen.options.overlays
            .BillingMode as CreateTableCommandInput['BillingMode'];
        }
        if (gen.options.overlays?.ProvisionedThroughput) {
          overlaysSafe.ProvisionedThroughput =
            gen.options.overlays.ProvisionedThroughput;
        }
        if (gen.options.overlays?.TableName) {
          overlaysSafe.TableName = gen.options.overlays.TableName;
        }
        const optionsSafe = {
          ...(gen.options.force ? { force: true } : {}),
          ...(Object.keys(overlaysSafe).length
            ? { overlays: overlaysSafe }
            : {}),
        };

        const out = await generateTableDefinitionAtVersion(
          em,
          gen.version,
          cfg,
          optionsSafe,
        );

        const action = out.refreshed ? 'refreshed' : 'created';
        console.info(`dynamodb generate: ${action} ${out.path}`);
        console.log(JSON.stringify({ action, path: out.path }, null, 2));
      });

    // validate: compare YAML generated sections vs EM output
    group
      .command('validate')
      .description('Validate generated YAML sections vs resolved EntityManager')
      // Version/layout flags
      .option('--version <string>', 'target version (NNN; dotenv-expanded)')
      .option('--tables-path <string>', 'tables root (dotenv-expanded)')
      .option('--token-table <string>', 'token (table) filename without ext')
      .option(
        '--token-entity-manager <string>',
        'token (entityManager) filename without ext',
      )
      .option(
        '--token-transform <string>',
        'token (transform) filename without ext',
      )
      .action(async (flags: Record<string, unknown>) => {
        const ctx = cli.getCtx();
        const envRef = ctx?.dotenv ?? process.env;
        const pluginCfg = getPluginConfig(cli);

        // Layout config precedence
        const cfg = resolveLayoutConfig(
          {
            tablesPath: flags.tablesPath as string | undefined,
            tokens: {
              table: flags.tokenTable as string | undefined,
              entityManager: flags.tokenEntityManager as string | undefined,
              transform: flags.tokenTransform as string | undefined,
            },
          },
          pluginCfg,
          envRef,
        );

        // Version precedence
        const { version } = resolveValidateAtVersion(
          { version: flags.version as string | undefined },
          pluginCfg,
          envRef,
        );

        const result = await validateTableDefinitionAtVersion(version, cfg);
        const summary = {
          tablePath: result.tablePath,
          equal: result.equal,
          diffs: result.diffs,
        };
        console.info(
          result.equal
            ? 'dynamodb validate: OK (no drift)'
            : 'dynamodb validate: drift detected',
        );
        console.log(JSON.stringify(summary, null, 2));
        if (!result.equal) process.exitCode = 1;
      });

    // Placeholders for future subcommands (create/delete/purge/migrate).
    // These will wire EntityClient instances and respect --force confirms per docs.
    // group.command('create')...
    // group.command('delete')...
    // group.command('purge')...
    // group.command('migrate')...
  },
});
