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
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--source-table <string>',
        (_bag, c) => {
          const v = c.migrate?.sourceTable;
          return `source table name (dotenv-expanded)${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--target-table <string>',
        (_bag, c) => {
          const v = c.migrate?.targetTable;
          return `target table name (dotenv-expanded)${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--from-version <string>',
        (_bag, c) => {
          const v = c.migrate?.fromVersion;
          return `from version (NNN; exclusive)${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--to-version <string>',
        (_bag, c) => {
          const v = c.migrate?.toVersion;
          return `to version (NNN; inclusive)${
            v ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
      ),
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
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--page-size <number>',
        (_bag, c) => {
          const v = c.migrate?.pageSize;
          return `scan page size${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parsePositiveInt('pageSize'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--limit <number>',
        (_bag, c) => {
          const v = c.migrate?.limit;
          return `max outputs${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parseNonNegativeInt('limit'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--transform-concurrency <number>',
        (_bag, c) => {
          const v = c.migrate?.transformConcurrency;
          return `transform concurrency${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parsePositiveInt('transformConcurrency'),
      ),
    )
    .addOption(
      plugin.createPluginDynamicOption(
        cli,
        '--progress-interval-ms <number>',
        (_bag, c) => {
          const v = c.migrate?.progressIntervalMs;
          return `progress tick interval ms${
            v !== undefined ? ` (default: ${JSON.stringify(v)})` : ''
          }`;
        },
        parsePositiveInt('progressIntervalMs'),
      ),
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
