import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import type { PluginWithInstanceHelpers } from '@karmaniverous/get-dotenv/cliHost';
import {
  readMergedOptions,
  shouldCapture,
} from '@karmaniverous/get-dotenv/cliHost';

import { startLocal, statusLocal, stopLocal } from '../../../services/local';
import type { DynamodbPluginConfig } from '../../options';

type PluginReader = Pick<PluginWithInstanceHelpers, 'readConfig'> & {
  readConfig(cli: GetDotenvCliPublic): Readonly<DynamodbPluginConfig>;
};

export function registerLocal(
  plugin: PluginReader,
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
    .option('--port <number>', 'override port for local endpoint')
    .action(
      async (
        flags: Record<string, unknown>,
        _opts: unknown,
        thisCommand: Command,
      ) => {
        try {
          const ctx = cli.getCtx();
          // Use ctx.dotenv as an overlay; include process.env (aws parent may write to it).
          const envRef = { ...process.env, ...(ctx?.dotenv ?? {}) };
          const pluginCfg = plugin.readConfig(cli);
          const bag = readMergedOptions(thisCommand) ?? {};
          const shell = (bag as { shell?: string | boolean }).shell;
          const capture = shouldCapture((bag as { capture?: boolean }).capture);

          const portOverride =
            flags.port !== undefined ? Number(flags.port) : undefined;

          const out = await startLocal({
            cfg: pluginCfg.local,
            envRef,
            shell,
            capture,
            portOverride,
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
      },
    );

  local
    .command('status')
    .option('--port <number>', 'override port for local endpoint')
    .action(
      async (
        flags: Record<string, unknown>,
        _opts: unknown,
        thisCommand: Command,
      ) => {
        try {
          const ctx = cli.getCtx();
          const envRef = { ...process.env, ...(ctx?.dotenv ?? {}) };
          const pluginCfg = plugin.readConfig(cli);
          const bag = readMergedOptions(thisCommand) ?? {};
          const shell = (bag as { shell?: string | boolean }).shell;
          const capture = shouldCapture((bag as { capture?: boolean }).capture);
          const portOverride =
            flags.port !== undefined ? Number(flags.port) : undefined;

          const ok = await statusLocal({
            cfg: pluginCfg.local,
            envRef,
            shell,
            capture,
            portOverride,
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
      },
    );

  local
    .command('stop')
    .action(
      async (
        _flags: Record<string, unknown>,
        _opts: unknown,
        thisCommand: Command,
      ) => {
        try {
          const ctx = cli.getCtx();
          const envRef = { ...process.env, ...(ctx?.dotenv ?? {}) };
          const pluginCfg = plugin.readConfig(cli);
          const bag = readMergedOptions(thisCommand) ?? {};
          const shell = (bag as { shell?: string | boolean }).shell;
          const capture = shouldCapture((bag as { capture?: boolean }).capture);

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
      },
    );
}
