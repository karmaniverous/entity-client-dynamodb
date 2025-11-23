/**
 * get-dotenv "dynamodb" plugin (host-aware).
 * Uses the public CLI host seam from \@karmaniverous/get-dotenv/cliHost.
 */

import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import {
  definePlugin,
  type GetDotenvCliPublic,
} from '@karmaniverous/get-dotenv/cliHost';

import { EntityClient } from '../../EntityClient';
import { resolveAndLoadEntityManager } from '../emLoader';
import { createTableAtVersion } from '../services/create';
import { deleteTable, purgeTable } from '../services/delete';
import { generateTableDefinitionAtVersion } from '../services/generate';
import { migrateData } from '../services/migrate';
import { validateTableDefinitionAtVersion } from '../services/validateTable';
import {
  type DynamodbPluginConfig,
  resolveCreateAtVersion,
  resolveDelete,
  resolveGenerateAtVersion,
  resolveLayoutConfig,
  resolveMigrate,
  resolvePurge,
  resolveValidateAtVersion,
} from './options';

function getPluginConfig(cli: GetDotenvCliPublic): DynamodbPluginConfig {
  const cfg = cli.getCtx()?.pluginConfigs?.dynamodb;
  return (cfg ?? {}) as DynamodbPluginConfig;
}

function buildEntityClient(
  em: unknown,
  tableName: string,
  envRef: Record<string, string | undefined> = process.env,
) {
  const region = envRef.AWS_REGION ?? envRef.AWS_DEFAULT_REGION ?? 'local';
  const endpoint =
    envRef.AWS_ENDPOINT_URL_DYNAMODB ??
    envRef.DYNAMODB_ENDPOINT ??
    `http://localhost:${envRef.DYNAMODB_LOCAL_PORT ?? '8000'}`;
  const credentials = {
    accessKeyId: envRef.AWS_ACCESS_KEY_ID ?? 'fake',
    secretAccessKey: envRef.AWS_SECRET_ACCESS_KEY ?? 'fake',
  };
  return new EntityClient({
    entityManager: em as never,
    tableName,
    region,
    endpoint,
    credentials,
  });
}

function ensureForce(force: unknown, op: string): boolean {
  if (force) return true;
  console.warn(`${op} requires confirmation. Re-run with --force to proceed.`);
  process.exitCode = 2;
  return false;
}

export const dynamodbPlugin = definePlugin({
  id: 'dynamodb',
  setup: (cli) => {
    const group = cli
      .ns('dynamodb')
      .description(
        'DynamoDB utilities (versioned table defs, lifecycle, migration)',
      );

    // generate
    group
      .command('generate')
      .description(
        'Compose or refresh tables/NNN/table.yml (comment-preserving)',
      )
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
      .option(
        '--overlay-billing-mode <string>',
        'BillingMode overlay (e.g., PAY_PER_REQUEST)',
      )
      .option(
        '--overlay-rcu <number>',
        'ProvisionedThroughput.ReadCapacityUnits',
      )
      .option(
        '--overlay-wcu <number>',
        'ProvisionedThroughput.WriteCapacityUnits',
      )
      .option('--overlay-table-name <string>', 'TableName overlay (one-off)')
      .option(
        '--force',
        'force compose even if file exists (else refresh)',
        false,
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
        const gen = resolveGenerateAtVersion(
          {
            version: flags.version as string | undefined,
            force: !!flags.force,
            overlays: {
              billingMode: flags.overlayBillingMode as string | undefined,
              readCapacityUnits: flags.overlayRcu as
                | number
                | string
                | undefined,
              writeCapacityUnits: flags.overlayWcu as
                | number
                | string
                | undefined,
              tableName: flags.overlayTableName as string | undefined,
            },
          },
          pluginCfg,
          envRef,
        );
        const em = await resolveAndLoadEntityManager(gen.version, cfg);
        const overlaysSafe: {
          BillingMode?: CreateTableCommandInput['BillingMode'];
          ProvisionedThroughput?: {
            ReadCapacityUnits: number;
            WriteCapacityUnits: number;
          };
          TableName?: string;
        } = {};
        if (gen.options.overlays?.BillingMode) {
          overlaysSafe.BillingMode = gen.options.overlays
            .BillingMode as CreateTableCommandInput['BillingMode'];
        }
        if (gen.options.overlays?.ProvisionedThroughput) {
          overlaysSafe.ProvisionedThroughput =
            gen.options.overlays.ProvisionedThroughput;
        }
        if (gen.options.overlays?.TableName) {
          overlaysSafe.TableName = gen.options.overlays.TableName;
        }
        const out = await generateTableDefinitionAtVersion(
          em,
          gen.version,
          cfg,
          {
            ...(gen.options.force ? { force: true } : {}),
            ...(Object.keys(overlaysSafe).length
              ? { overlays: overlaysSafe }
              : {}),
          },
        );
        const action = out.refreshed ? 'refreshed' : 'created';
        console.info(`dynamodb generate: ${action} ${out.path}`);
        console.log(JSON.stringify({ action, path: out.path }, null, 2));
      });

    // validate
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

    // create
    group
      .command('create')
      .description(
        'Create table from tables/NNN/table.yml (validate/refresh as configured)',
      )
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
      .option('--validate', 'validate before create (default true)', false)
      .option(
        '--refresh-generated',
        'refresh generated sections (default false)',
        false,
      )
      .option(
        '--force',
        'proceed on drift when --validate (default false)',
        false,
      )
      .option('--max-seconds <number>', 'waiter max seconds')
      .option('--table-name-override <string>', 'one-off TableName override')
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
        const { version, options } = resolveCreateAtVersion(
          {
            version: flags.version as string | undefined,
            validate: flags.validate as boolean | undefined,
            refreshGenerated: flags.refreshGenerated as boolean | undefined,
            force: flags.force as boolean | undefined,
            maxSeconds: flags.maxSeconds as number | string | undefined,
            tableNameOverride: flags.tableNameOverride as string | undefined,
          },
          pluginCfg,
          envRef,
        );
        const em = await resolveAndLoadEntityManager(version, cfg);
        const clientTable =
          options.tableNameOverride ??
          envRef.TABLE_NAME ??
          envRef.DYNAMODB_TABLE ??
          'DynamoDBTable';
        const client = buildEntityClient(em, clientTable, envRef);
        const out = await createTableAtVersion(
          client,
          em,
          version,
          cfg,
          options,
        );
        const waiterStateCreate =
          out.waiterResult && out.waiterResult.state
            ? out.waiterResult.state
            : 'UNKNOWN';
        console.info('dynamodb create: ' + waiterStateCreate);
        console.log(JSON.stringify({ waiter: waiterStateCreate }, null, 2));
      });

    // delete
    group
      .command('delete')
      .description(
        'Delete a DynamoDB table (waiter). Use --force to skip confirmation.',
      )
      .option('--table-name <string>', 'table name (dotenv-expanded)')
      .option('--version <string>', 'EM version for client wiring (optional)')
      .option('--max-seconds <number>', 'waiter max seconds')
      .option('--force', 'proceed without confirmation', false)
      .action(async (flags: Record<string, unknown>) => {
        if (!ensureForce(flags.force, 'delete-table')) return;
        const ctx = cli.getCtx();
        const envRef = ctx?.dotenv ?? process.env;
        const pluginCfg = getPluginConfig(cli);
        const { options } = resolveDelete(
          {
            tableName: flags.tableName as string | undefined,
            maxSeconds: flags.maxSeconds as number | string | undefined,
          },
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
        const out = await deleteTable(client, options);
        const waiterStateDelete =
          out.waiterResult && out.waiterResult.state
            ? out.waiterResult.state
            : 'UNKNOWN';
        console.info('dynamodb delete: ' + waiterStateDelete);
        console.log(JSON.stringify({ waiter: waiterStateDelete }, null, 2));
      });

    // purge
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
        const pluginCfg = getPluginConfig(cli);
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

    // migrate
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
  },
});
