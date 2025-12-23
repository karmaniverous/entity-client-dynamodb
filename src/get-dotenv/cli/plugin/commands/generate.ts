import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { generateTableDefinitionAtVersion } from '../../../services/generate';
import { resolveGenerateAtVersion, resolveLayoutConfig } from '../../options';
import { parsePositiveInt } from '../parsers';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerGenerate(
  plugin: DynamodbPluginInstance,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  group
    .command('generate')
    .description('Compose or refresh tables/NNN/table.yml (comment-preserving)')
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
    .option(
      '--overlay-billing-mode <string>',
      'BillingMode overlay (e.g., PAY_PER_REQUEST)',
    )
    .option(
      '--overlay-rcu <number>',
      'ProvisionedThroughput.ReadCapacityUnits',
      parsePositiveInt('overlayRcu'),
    )
    .option(
      '--overlay-wcu <number>',
      'ProvisionedThroughput.WriteCapacityUnits',
      parsePositiveInt('overlayWcu'),
    )
    .option('--overlay-table-name <string>', 'TableName overlay (one-off)')
    .option('--force', 'force compose even if file exists (else refresh)')
    .action(async (opts, thisCommand) => {
      void thisCommand;
      const ctx = cli.getCtx();
      const envRef = ctx.dotenv;
      const pluginCfg = plugin.readConfig(cli);
      const cfg = resolveLayoutConfig(
        {
          tablesPath: opts.tablesPath,
          tokens: {
            table: opts.tokenTable,
            entityManager: opts.tokenEntityManager,
            transform: opts.tokenTransform,
          },
        },
        pluginCfg,
        envRef,
      );
      const gen = resolveGenerateAtVersion(
        {
          version: opts.version,
          force: !!opts.force,
          overlays: {
            billingMode: opts.overlayBillingMode,
            readCapacityUnits: opts.overlayRcu,
            writeCapacityUnits: opts.overlayWcu,
            tableName: opts.overlayTableName,
          },
        },
        pluginCfg,
        envRef,
      );
      const em = await resolveAndLoadEntityManager(gen.version, cfg);
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
      const out = await generateTableDefinitionAtVersion(em, gen.version, cfg, {
        ...(gen.options.force ? { force: true } : {}),
        ...(Object.keys(overlaysSafe).length ? { overlays: overlaysSafe } : {}),
      });
      const action = out.refreshed ? 'refreshed' : 'created';
      console.info(`dynamodb generate: ${action} ${out.path}`);
      console.log(JSON.stringify({ action, path: out.path }, null, 2));
    });
}
