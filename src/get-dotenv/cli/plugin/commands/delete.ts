import type { Command } from '@commander-js/extra-typings';
import { assertLogger, parsePositiveInt } from '@karmaniverous/get-dotenv';
import {
  ensureForce,
  type GetDotenvCliPublic,
  readMergedOptions,
} from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { deleteTable } from '../../../services/delete';
import { resolveDelete, resolveLayoutConfig } from '../../options';
import { buildEntityClient } from '../helpers';
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
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--table-name <string>',
        (_bag, c) => {
          const t = c.delete?.tableName;
          return `table name (dotenv-expanded)${
            t ? ` (default: ${JSON.stringify(t)})` : ''
          }`;
        },
      ),
    )
    .option('--version <string>', 'EM version for client wiring (optional)')
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--max-seconds <number>',
        (_bag, c) => {
          const s = c.delete?.waiter?.maxSeconds;
          return `waiter max seconds${
            s !== undefined ? ` (default: ${JSON.stringify(s)})` : ''
          }`;
        },
        parsePositiveInt('maxSeconds'),
      ),
    )
    .option('--force', 'proceed without confirmation')
    .action(async (opts, thisCommand) => {
      if (!ensureForce(opts.force, 'delete-table')) return;
      const bag = readMergedOptions(thisCommand);
      const logger = assertLogger(bag.logger);
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
      const client = buildEntityClient(em, tableName, envRef, logger);
      const out = await deleteTable(client, options);
      const waiterState = out.waiterResult.state;
      logger.info(`dynamodb delete: ${waiterState}`);
      process.stdout.write(
        JSON.stringify({ waiter: waiterState }, null, 2) + '\n',
      );
    });
}
