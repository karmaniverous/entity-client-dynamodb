import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import type { PluginWithInstanceHelpers } from '@karmaniverous/get-dotenv/cliHost';
import type { Command } from 'commander';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { purgeTable } from '../../../services/delete';
import type { DynamodbPluginConfig } from '../../options';
import { resolveLayoutConfig, resolvePurge } from '../../options';
import { buildEntityClient, ensureForce } from '../helpers';

type PluginReader = Pick<PluginWithInstanceHelpers, 'readConfig'> & {
  readConfig(cli: GetDotenvCliPublic): Readonly<DynamodbPluginConfig>;
};

export function registerPurge(
  plugin: PluginReader,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  group
    .command('purge')
    .description(
      'Purge all items from a DynamoDB table. Use --force to skip confirmation.',
    )
    .option('--table-name <string>', 'table name (dotenv-expanded)')
    .option('--version <string>', 'EM version for client wiring (optional)')
    .option('--force', 'proceed without confirmation', false)
    .action(async (flags: Record<string, unknown>) => {
      if (!ensureForce(flags.force, 'purge-table')) return;
      const ctx = cli.getCtx();
      const envRef = ctx?.dotenv ?? process.env;
      const pluginCfg = plugin.readConfig(cli);
      const { options } = resolvePurge(
        { tableName: flags.tableName as string | undefined },
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
      const count = await purgeTable(client, options);
      console.info('dynamodb purge: ' + String(count));
      console.log(JSON.stringify({ purged: count }, null, 2));
    });
}
