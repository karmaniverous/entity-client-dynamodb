import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import type { PluginWithInstanceHelpers } from '@karmaniverous/get-dotenv/cliHost';
import type { Command } from 'commander';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { migrateData } from '../../../services/migrate';
import type { DynamodbPluginConfig } from '../../options';
import { resolveLayoutConfig, resolveMigrate } from '../../options';
import { buildEntityClient, ensureForce } from '../helpers';

type PluginReader = Pick<PluginWithInstanceHelpers, 'readConfig'> & {
  readConfig(cli: GetDotenvCliPublic): Readonly<DynamodbPluginConfig>;
};

export function registerMigrate(
  plugin: PluginReader,
  cli: GetDotenvCliPublic,
  group: Command,
) {
  group
    .command('migrate')
    .description(
      'Migrate data across versioned steps with optional per-step transforms',
    )
    .option('--source-table <string>', 'source table name (dotenv-expanded)')
    .option('--target-table <string>', 'target table name (dotenv-expanded)')
    .option('--from-version <string>', 'from version (NNN; exclusive)')
    .option('--to-version <string>', 'to version (NNN; inclusive)')
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
    .option('--page-size <number>', 'scan page size (default 100)')
    .option('--limit <number>', 'max outputs (default Infinity)')
    .option(
      '--transform-concurrency <number>',
      'transform concurrency (default 1)',
    )
    .option(
      '--progress-interval-ms <number>',
      'progress tick interval ms (default 2000)',
    )
    .option('--force', 'proceed without confirmation', false)
    .action(async (flags: Record<string, unknown>) => {
      if (!ensureForce(flags.force, 'migrate-data')) return;
      const ctx = cli.getCtx();
      const envRef = ctx?.dotenv ?? process.env;
      const pluginCfg = plugin.readConfig(cli);
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
      const m = resolveMigrate(
        {
          sourceTable: flags.sourceTable as string | undefined,
          targetTable: flags.targetTable as string | undefined,
          fromVersion: flags.fromVersion as string | undefined,
          toVersion: flags.toVersion as string | undefined,
          pageSize: flags.pageSize as number | string | undefined,
          limit: flags.limit as number | string | undefined,
          transformConcurrency: flags.transformConcurrency as
            | number
            | string
            | undefined,
          progressIntervalMs: flags.progressIntervalMs as
            | number
            | string
            | undefined,
        },
        pluginCfg,
        envRef,
      );
      const emFrom = await resolveAndLoadEntityManager(m.fromVersion, cfg);
      const emTo = await resolveAndLoadEntityManager(m.toVersion, cfg);
      const sourceTable =
        m.sourceTableName ??
        envRef.SOURCE_TABLE ??
        envRef.TABLE_NAME ??
        'Source';
      const targetTable =
        m.targetTableName ??
        envRef.TARGET_TABLE ??
        envRef.TABLE_NAME ??
        'Target';
      const source = buildEntityClient(emFrom, sourceTable, envRef);
      const target = buildEntityClient(emTo, targetTable, envRef);
      const out = await migrateData(source, target, {
        fromVersion: m.fromVersion,
        toVersion: m.toVersion,
        cfg,
        ...(m.pageSize !== undefined ? { pageSize: m.pageSize } : {}),
        ...(m.limit !== undefined ? { limit: m.limit } : {}),
        ...(m.transformConcurrency !== undefined
          ? { transformConcurrency: m.transformConcurrency }
          : {}),
        ...(m.progressIntervalMs !== undefined
          ? { progressIntervalMs: m.progressIntervalMs }
          : {}),
        onProgress: (p) => {
          console.info(
            'migrate progress: pages=' +
              String(p.pages) +
              ' items=' +
              String(p.items) +
              ' outputs=' +
              String(p.outputs) +
              ' rate=' +
              p.ratePerSec.toFixed(2) +
              '/s',
          );
        },
      });
      console.info(
        'migrate done: pages=' +
          String(out.pages) +
          ' items=' +
          String(out.items) +
          ' outputs=' +
          String(out.outputs),
      );
      console.log(JSON.stringify(out, null, 2));
    });
}
