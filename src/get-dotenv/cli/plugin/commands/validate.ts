import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import type { Command } from 'commander';

import { validateTableDefinitionAtVersion } from '../../../get-dotenv/services/validateTable';
import { resolveLayoutConfig, resolveValidateAtVersion } from '../../options';
import { getPluginConfig } from '../helpers';

export function registerValidate(cli: GetDotenvCliPublic, group: Command) {
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
    .action(async (flags: Record<string, unknown>) => {
      const ctx = cli.getCtx();
      const envRef = ctx?.dotenv ?? process.env;
      const pluginCfg = getPluginConfig(cli);
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
      const { version } = resolveValidateAtVersion(
        { version: flags.version as string | undefined },
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
