import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { purgeTable } from '../../../services/delete';
import { resolveLayoutConfig, resolvePurge } from '../../options';
import { buildEntityClient, ensureForce } from '../helpers';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerPurge(
  plugin: DynamodbPluginInstance,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  group
    .command('purge')
    .description(
      'Purge all items from a DynamoDB table. Use --force to skip confirmation.',
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--table-name <string>',
        (_bag, c) => {
          const t = c.purge?.tableName;
          return `table name (dotenv-expanded)${
            t ? ` (default: ${JSON.stringify(t)})` : ''
          }`;
        },
      ),
    )
    .option('--version <string>', 'EM version for client wiring (optional)')
    .option('--force', 'proceed without confirmation')
    .action(async (opts, thisCommand) => {
      void thisCommand;
      if (!ensureForce(opts.force, 'purge-table')) return;
      const ctx = cli.getCtx();
      const envRef = ctx.dotenv;
      const env = { ...process.env, ...envRef };
      const pluginCfg = plugin.readConfig(cli);
      const { options } = resolvePurge(
        { tableName: opts.tableName },
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
      const count = await purgeTable(client, options);
      console.info('dynamodb purge: ' + String(count));
      console.log(JSON.stringify({ purged: count }, null, 2));
    });
}
