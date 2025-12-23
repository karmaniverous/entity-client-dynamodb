import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { deleteTable } from '../../../services/delete';
import { resolveDelete, resolveLayoutConfig } from '../../options';
import { buildEntityClient, ensureForce } from '../helpers';
import { parsePositiveInt } from '../parsers';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerDelete(
  plugin: DynamodbPluginInstance,
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
    .option(
      '--max-seconds <number>',
      'waiter max seconds',
      parsePositiveInt('maxSeconds'),
    )
    .option('--force', 'proceed without confirmation')
    .action(async (opts, thisCommand) => {
      void thisCommand;
      if (!ensureForce(opts.force, 'delete-table')) return;
      const ctx = cli.getCtx();
      const envRef = ctx.dotenv;
      const env = { ...process.env, ...envRef };
      const pluginCfg = plugin.readConfig(cli);
      const { options } = resolveDelete(
        {
          tableName: opts.tableName,
          maxSeconds: opts.maxSeconds,
        },
        pluginCfg,
        envRef,
      );
      const version = opts.version ?? '000';
      const cfg = resolveLayoutConfig({}, pluginCfg, envRef);
      const em = await resolveAndLoadEntityManager(version, cfg);
      const tableName =
        options.tableNameOverride ??
        env.TABLE_NAME ??
        env.DYNAMODB_TABLE ??
        'DynamoDBTable';
      const client = buildEntityClient(em, tableName, envRef);
      const out = await deleteTable(client, options);
      const waiterStateDelete = out.waiterResult.state;
      console.info('dynamodb delete: ' + waiterStateDelete);
      console.log(JSON.stringify({ waiter: waiterStateDelete }, null, 2));
    });
}
