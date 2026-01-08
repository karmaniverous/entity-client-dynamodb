import type { Command } from '@commander-js/extra-typings';
import { assertLogger } from '@karmaniverous/get-dotenv';
import {
  type GetDotenvCliPublic,
  readMergedOptions,
} from '@karmaniverous/get-dotenv/cliHost';

import { validateTableDefinitionAtVersion } from '../../../services/validateTable';
import { resolveManagedTableProperties } from '../../../tableProperties';
import { resolveLayoutConfig, resolveValidateAtVersion } from '../../options';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerValidate(
  plugin: DynamodbPluginInstance,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  group
    .command('validate')
    .description('Validate generated YAML sections vs resolved EntityManager')
    .addOption(
      plugin.createPluginDynamicOption(cli, '--version <string>', (_bag, c) => {
        const v = c.validate?.version;
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
    .action(async (opts, thisCommand) => {
      const bag = readMergedOptions(thisCommand);
      const logger = assertLogger(bag.logger);
      const ctx = cli.getCtx();
      const envRef = ctx.dotenv;
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
      const { version } = resolveValidateAtVersion(
        { version: opts.version },
        pluginCfg,
        envRef,
      );
      const managed = resolveManagedTableProperties(
        pluginCfg.generate?.tableProperties,
      );
      const result = await validateTableDefinitionAtVersion(
        version,
        cfg,
        managed,
      );
      logger.info(
        result.equal
          ? 'dynamodb validate: OK (no drift)'
          : 'dynamodb validate: drift detected',
      );
      process.stdout.write(
        JSON.stringify(
          {
            tablePath: result.tablePath,
            equal: result.equal,
            diffs: result.diffs,
          },
          null,
          2,
        ) + '\n',
      );
      if (!result.equal) process.exitCode = 1;
    });
}
