import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import {
  readMergedOptions,
  shouldCapture,
} from '@karmaniverous/get-dotenv/cliHost';

import { startLocal, statusLocal, stopLocal } from '../../../services/local';
import { parsePositiveInt } from '../parsers';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerLocal(
  plugin: DynamodbPluginInstance,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  const local = group
    .command('local')
    .description(
      'Local DynamoDB orchestration (config-first; embedded fallback)',
    );

  local
    .command('start')
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--port <number>',
        (_bag, c) => {
          const p = c.local?.port;
          return `override port for local endpoint${
            p !== undefined ? ` (default: ${JSON.stringify(p)})` : ''
          }`;
        },
        parsePositiveInt('port'),
      ),
    )
    .action(async (opts, thisCommand) => {
      try {
        const ctx = cli.getCtx();
        // Use ctx.dotenv as an overlay; include process.env (aws parent may write to it).
        const envRef = { ...process.env, ...ctx.dotenv };
        const pluginCfg = plugin.readConfig(cli);
        const bag = readMergedOptions(thisCommand);
        const shell = bag.shell;
        const capture = shouldCapture(bag.capture);

        const out = await startLocal({
          cfg: pluginCfg.local,
          envRef,
          shell,
          capture,
          ...(opts.port !== undefined
            ? { portOverride: Number(opts.port) }
            : {}),
        });

        const { endpoint } = out;
        // UX: endpoint + export hint
        console.info(`local dynamodb: endpoint ${endpoint}`);
        console.log(JSON.stringify({ endpoint }, null, 2));
        console.info(
          `Hint: export DYNAMODB_LOCAL_ENDPOINT=${endpoint} so app code targets Local.`,
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'local dynamodb start failed';
        console.error(msg);
        process.exitCode = 1;
      }
    });

  local
    .command('status')
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--port <number>',
        (_bag, c) => {
          const p = c.local?.port;
          return `override port for local endpoint${
            p !== undefined ? ` (default: ${JSON.stringify(p)})` : ''
          }`;
        },
        parsePositiveInt('port'),
      ),
    )
    .action(async (opts, thisCommand) => {
      try {
        const ctx = cli.getCtx();
        const envRef = { ...process.env, ...ctx.dotenv };
        const pluginCfg = plugin.readConfig(cli);
        const bag = readMergedOptions(thisCommand);
        const shell = bag.shell;
        const capture = shouldCapture(bag.capture);

        const ok = await statusLocal({
          cfg: pluginCfg.local,
          envRef,
          shell,
          capture,
          ...(opts.port !== undefined
            ? { portOverride: Number(opts.port) }
            : {}),
        });
        if (!ok) {
          process.exitCode = 1;
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'local dynamodb status failed';
        console.error(msg);
        process.exitCode = 1;
      }
    });

  local.command('stop').action(async (_opts, thisCommand) => {
    void _opts;
    try {
      const ctx = cli.getCtx();
      const envRef = { ...process.env, ...ctx.dotenv };
      const pluginCfg = plugin.readConfig(cli);
      const bag = readMergedOptions(thisCommand);
      const shell = bag.shell;
      const capture = shouldCapture(bag.capture);

      await stopLocal({
        cfg: pluginCfg.local,
        envRef,
        shell,
        capture,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'local dynamodb stop failed';
      console.error(msg);
      process.exitCode = 1;
    }
  });
}
