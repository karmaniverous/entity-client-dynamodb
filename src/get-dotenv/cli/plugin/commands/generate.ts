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
        '--table-billing-mode <string>',
        (_bag, c) => {
          const v = c.generate?.tableProperties?.billingMode;
          return `Managed Properties.BillingMode (e.g., PROVISIONED)${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--table-rcu <number>',
        (_bag, c) => {
          const v = c.generate?.tableProperties?.readCapacityUnits;
          return `Managed Properties.ProvisionedThroughput.ReadCapacityUnits${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parsePositiveInt('tableRcu'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--table-wcu <number>',
        (_bag, c) => {
          const v = c.generate?.tableProperties?.writeCapacityUnits;
          return `Managed Properties.ProvisionedThroughput.WriteCapacityUnits${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parsePositiveInt('tableWcu'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--table-name <string>',
        (_bag, c) => {
          const v = c.generate?.tableProperties?.tableName;
          return `Managed Properties.TableName${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
    )
    .option(
      '--clean',
      'recompose table.yml from baseline + generated + managed props',
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
          clean: !!opts.clean,
          tableProperties: {
            billingMode: opts.tableBillingMode,
            readCapacityUnits: opts.tableRcu,
            writeCapacityUnits: opts.tableWcu,
            tableName: opts.tableName,
          },
        },
        pluginCfg,
        envRef,
      );
      const em = await resolveAndLoadEntityManager(gen.version, cfg);
      const out = await generateTableDefinitionAtVersion(em, gen.version, cfg, {
        ...(gen.options.clean ? { clean: true } : {}),
        ...(gen.options.tableProperties
          ? { tableProperties: gen.options.tableProperties }
          : {}),
      });
      const action = out.refreshed ? 'refreshed' : 'created';
      console.info(`dynamodb generate: ${action} ${out.path}`);
      console.log(JSON.stringify({ action, path: out.path }, null, 2));
    });
}
