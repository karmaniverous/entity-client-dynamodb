import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import type { PluginWithInstanceHelpers } from '@karmaniverous/get-dotenv/cliHost';
import type { Command } from 'commander';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { deleteTable } from '../../../services/delete';
import type { DynamodbPluginConfig } from '../../options';
import { resolveDelete, resolveLayoutConfig } from '../../options';
import { buildEntityClient, ensureForce } from '../helpers';

type PluginReader = Pick<PluginWithInstanceHelpers, 'readConfig'> & {
  readConfig(cli: GetDotenvCliPublic): Readonly<DynamodbPluginConfig>;
};

export function registerDelete(
  plugin: PluginReader,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  group
    .command('delete')
    .description(
      'Delete a DynamoDB table (waiter). Use --force to skip confirmation.',
    )
    .option('--table-name <string>', 'table name (dotenv-expanded)')
    .option('--version <string>', 'EM version for client wiring (optional)')
    .option('--max-seconds <number>', 'waiter max seconds')
    .option('--force', 'proceed without confirmation', false)
    .action(async (flags: Record<string, unknown>) => {
      if (!ensureForce(flags.force, 'delete-table')) return;
      const ctx = cli.getCtx();
      const envRef = ctx?.dotenv ?? process.env;
      const pluginCfg = plugin.readConfig(cli);
      const { options } = resolveDelete(
        {
          tableName: flags.tableName as string | undefined,
          maxSeconds: flags.maxSeconds as number | string | undefined,
        },
        pluginCfg,
        envRef,
      );
      const version = (flags.version as string | undefined) ?? '000';
      const cfg = resolveLayoutConfig({}, pluginCfg, envRef);
      const em = await resolveAndLoadEntityManager(version, cfg);
      const tableName =
        options.tableNameOverride ??
        envRef.TABLE_NAME ??
        envRef.DYNAMODB_TABLE ??
        'DynamoDBTable';
      const client = buildEntityClient(em, tableName, envRef);
      const out = await deleteTable(client, options);
      const waiterStateDelete = out.waiterResult.state;
      console.info('dynamodb delete: ' + waiterStateDelete);
      console.log(JSON.stringify({ waiter: waiterStateDelete }, null, 2));
    });
}
