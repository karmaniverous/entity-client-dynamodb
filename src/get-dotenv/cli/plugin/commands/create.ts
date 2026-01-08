import type { Command } from '@commander-js/extra-typings';
import { parsePositiveInt } from '@karmaniverous/get-dotenv';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { createTableAtVersion } from '../../../services/create';
import { resolveManagedTableProperties } from '../../../tableProperties';
import { resolveCreateAtVersion, resolveLayoutConfig } from '../../options';
import { buildEntityClient } from '../helpers';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerCreate(
  plugin: DynamodbPluginInstance,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  const cmd = group
    .command('create')
    .description(
      'Create table from tables/NNN/table.yml (validate/refresh as configured)',
    )
    .addOption(
      plugin.createPluginDynamicOption(cli, '--version <string>', (_bag, c) => {
        const v = c.create?.version;
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
    .option('--validate', 'validate before create (default true)')
    .option('--refresh-generated', 'refresh generated sections (default false)')
    .option(
      '--allow-non-latest',
      'allow creating a non-latest version (unsafe)',
    )
    .option('--force', 'proceed on drift when --validate (default false)')
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--max-seconds <number>',
        (_bag, c) => {
          const s = c.create?.waiter?.maxSeconds;
          return `waiter max seconds${
            s !== undefined ? ` (default: ${JSON.stringify(s)})` : ''
          }`;
        },
        parsePositiveInt('maxSeconds'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--table-name-override <string>',
        (_bag, c) => {
          const t = c.create?.tableNameOverride;
          return `one-off TableName override${
            t ? ` (default: ${JSON.stringify(t)})` : ''
          }`;
        },
      ),
    )
    .action(async (opts, thisCommand) => {
      void thisCommand;
      const ctx = cli.getCtx();
      const envRef = ctx.dotenv;
      const env = { ...process.env, ...envRef };
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
      const { version, options } = resolveCreateAtVersion(
        {
          version: opts.version,
          validate: opts.validate,
          refreshGenerated: opts.refreshGenerated,
          allowNonLatest: opts.allowNonLatest,
          force: opts.force,
          maxSeconds: opts.maxSeconds,
          tableNameOverride: opts.tableNameOverride,
        },
        pluginCfg,
        envRef,
      );
      const managed = resolveManagedTableProperties(
        pluginCfg.generate?.tableProperties,
      );
      const em = await resolveAndLoadEntityManager(version, cfg);
      const clientTable =
        options.tableNameOverride ??
        env.TABLE_NAME ??
        env.DYNAMODB_TABLE ??
        'DynamoDBTable';
      const client = buildEntityClient(em, clientTable, envRef);
      const out = await createTableAtVersion(client, em, version, cfg, {
        ...options,
        managedTableProperties: managed,
      });
      const waiterStateCreate = out.waiterResult.state;
      console.info('dynamodb create: ' + waiterStateCreate);
      console.log(JSON.stringify({ waiter: waiterStateCreate }, null, 2));
    });
  void cmd;
}
