import type { Command } from '@commander-js/extra-typings';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { resolveAndLoadEntityManager } from '../../../emLoader';
import { migrateData } from '../../../services/migrate';
import { resolveLayoutConfig, resolveMigrate } from '../../options';
import { buildEntityClient, ensureForce } from '../helpers';
import { parseNonNegativeInt, parsePositiveInt } from '../parsers';
import type { DynamodbPluginInstance } from '../pluginInstance';

export function registerMigrate(
  plugin: DynamodbPluginInstance,
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
    .option(
      '--page-size <number>',
      'scan page size (default 100)',
      parsePositiveInt('pageSize'),
    )
    .option(
      '--limit <number>',
      'max outputs (default Infinity)',
      parseNonNegativeInt('limit'),
    )
    .option(
      '--transform-concurrency <number>',
      'transform concurrency (default 1)',
      parsePositiveInt('transformConcurrency'),
    )
    .option(
      '--progress-interval-ms <number>',
      'progress tick interval ms (default 2000)',
      parsePositiveInt('progressIntervalMs'),
    )
    .option('--force', 'proceed without confirmation')
    .action(async (opts, thisCommand) => {
      void thisCommand;
      if (!ensureForce(opts.force, 'migrate-data')) return;
      const ctx = cli.getCtx();
      const envRef = ctx.dotenv;
      const env = { ...process.env, ...envRef };
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
      const m = resolveMigrate(
        {
          sourceTable: opts.sourceTable,
          targetTable: opts.targetTable,
          fromVersion: opts.fromVersion,
          toVersion: opts.toVersion,
          pageSize: opts.pageSize,
          limit: opts.limit,
          transformConcurrency: opts.transformConcurrency,
          progressIntervalMs: opts.progressIntervalMs,
        },
        pluginCfg,
        envRef,
      );
      const emFrom = await resolveAndLoadEntityManager(m.fromVersion, cfg);
      const emTo = await resolveAndLoadEntityManager(m.toVersion, cfg);
      const sourceTable =
        m.sourceTableName ?? env.SOURCE_TABLE ?? env.TABLE_NAME ?? 'Source';
      const targetTable =
        m.targetTableName ?? env.TARGET_TABLE ?? env.TABLE_NAME ?? 'Target';
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
