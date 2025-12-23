import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { createTableAtVersion } from '../../../services/create';
import { resolveCreateAtVersion, resolveLayoutConfig } from '../../options';
import { buildEntityClient } from '../helpers';
import { parsePositiveInt } from '../parsers';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerCreate(
  plugin: DynamodbPluginInstance,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  group
    .command('create')
    .description(
      'Create table from tables/NNN/table.yml (validate/refresh as configured)',
    )
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
    .option('--validate', 'validate before create (default true)')
    .option('--refresh-generated', 'refresh generated sections (default false)')
    .option('--force', 'proceed on drift when --validate (default false)')
    .option(
      '--max-seconds <number>',
      'waiter max seconds',
      parsePositiveInt('maxSeconds'),
    )
    .option('--table-name-override <string>', 'one-off TableName override')
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
          force: opts.force,
          maxSeconds: opts.maxSeconds,
          tableNameOverride: opts.tableNameOverride,
        },
        pluginCfg,
        envRef,
      );
      const em = await resolveAndLoadEntityManager(version, cfg);
      const clientTable =
        options.tableNameOverride ??
        env.TABLE_NAME ??
        env.DYNAMODB_TABLE ??
        'DynamoDBTable';
      const client = buildEntityClient(em, clientTable, envRef);
      const out = await createTableAtVersion(client, em, version, cfg, options);
      const waiterStateCreate = out.waiterResult.state;
      console.info('dynamodb create: ' + waiterStateCreate);
      console.log(JSON.stringify({ waiter: waiterStateCreate }, null, 2));
    });
}
