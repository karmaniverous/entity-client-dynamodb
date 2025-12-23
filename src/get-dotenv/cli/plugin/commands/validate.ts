import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { validateTableDefinitionAtVersion } from '../../../services/validateTable';
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
    .action(async (opts, thisCommand) => {
      void thisCommand;
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
      const result = await validateTableDefinitionAtVersion(version, cfg);
      console.info(
        result.equal
          ? 'dynamodb validate: OK (no drift)'
          : 'dynamodb validate: drift detected',
      );
      console.log(
        JSON.stringify(
          {
            tablePath: result.tablePath,
            equal: result.equal,
            diffs: result.diffs,
          },
          null,
          2,
        ),
      );
      if (!result.equal) process.exitCode = 1;
    });
}
