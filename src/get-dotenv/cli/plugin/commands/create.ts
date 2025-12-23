import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import type { PluginWithInstanceHelpers } from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { createTableAtVersion } from '../../../services/create';
import type { DynamodbPluginConfig } from '../../options';
import { resolveCreateAtVersion, resolveLayoutConfig } from '../../options';
import { buildEntityClient } from '../helpers';

type PluginReader = Pick<PluginWithInstanceHelpers, 'readConfig'> & {
  readConfig(cli: GetDotenvCliPublic): Readonly<DynamodbPluginConfig>;
};

export function registerCreate(
  plugin: PluginReader,
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
    .option('--validate', 'validate before create (default true)', false)
    .option(
      '--refresh-generated',
      'refresh generated sections (default false)',
      false,
    )
    .option(
      '--force',
      'proceed on drift when --validate (default false)',
      false,
    )
    .option('--max-seconds <number>', 'waiter max seconds')
    .option('--table-name-override <string>', 'one-off TableName override')
    .action(async (flags: Record<string, unknown>) => {
      const ctx = cli.getCtx();
      const envRef = ctx?.dotenv ?? process.env;
      const pluginCfg = plugin.readConfig(cli);
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
      const { version, options } = resolveCreateAtVersion(
        {
          version: flags.version as string | undefined,
          validate: flags.validate as boolean | undefined,
          refreshGenerated: flags.refreshGenerated as boolean | undefined,
          force: flags.force as boolean | undefined,
          maxSeconds: flags.maxSeconds as number | string | undefined,
          tableNameOverride: flags.tableNameOverride as string | undefined,
        },
        pluginCfg,
        envRef,
      );
      const em = await resolveAndLoadEntityManager(version, cfg);
      const clientTable =
        options.tableNameOverride ??
        envRef.TABLE_NAME ??
        envRef.DYNAMODB_TABLE ??
        'DynamoDBTable';
      const client = buildEntityClient(em, clientTable, envRef);
      const out = await createTableAtVersion(client, em, version, cfg, options);
      const waiterStateCreate = out.waiterResult.state;
      console.info('dynamodb create: ' + waiterStateCreate);
      console.log(JSON.stringify({ waiter: waiterStateCreate }, null, 2));
    });
}
