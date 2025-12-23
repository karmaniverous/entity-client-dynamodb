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
    .addOption(
      plugin.createPluginDynamicOption(cli, '--version <string>', (_bag, c) => {
        const v = c.generate?.version;
        return `target version (NNN; dotenv-expanded)${
          v ? ` (default: ${JSON.stringify(v)})` : ''
        }`;
      }),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--tables-path <string>',
        (_bag, c) => {
          const p = c.tablesPath;
          return `tables root (dotenv-expanded)${
            p ? ` (default: ${JSON.stringify(p)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--token-table <string>',
        (_bag, c) => {
          const t = c.tokens?.table;
          return `token (table) filename without ext${
            t ? ` (default: ${JSON.stringify(t)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--token-entity-manager <string>',
        (_bag, c) => {
          const t = c.tokens?.entityManager;
          return `token (entityManager) filename without ext${
            t ? ` (default: ${JSON.stringify(t)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--token-transform <string>',
        (_bag, c) => {
          const t = c.tokens?.transform;
          return `token (transform) filename without ext${
            t ? ` (default: ${JSON.stringify(t)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--overlay-billing-mode <string>',
        (_bag, c) => {
          const v = c.generate?.overlays?.billingMode;
          return `BillingMode overlay (e.g., PAY_PER_REQUEST)${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--overlay-rcu <number>',
        (_bag, c) => {
          const v = c.generate?.overlays?.readCapacityUnits;
          return `ProvisionedThroughput.ReadCapacityUnits${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parsePositiveInt('overlayRcu'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--overlay-wcu <number>',
        (_bag, c) => {
          const v = c.generate?.overlays?.writeCapacityUnits;
          return `ProvisionedThroughput.WriteCapacityUnits${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parsePositiveInt('overlayWcu'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--overlay-table-name <string>',
        (_bag, c) => {
          const v = c.generate?.overlays?.tableName;
          return `TableName overlay (one-off)${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(cli, '--force', (_bag, c) => {
        const v = c.generate?.force;
        return `force compose even if file exists (else refresh)${
          v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
        }`;
      }),
    )
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
