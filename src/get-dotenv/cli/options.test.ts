import { describe, expect, it } from 'vitest';

import type { DynamodbPluginConfig } from './options';
import {
  resolveCreateAtVersion,
  resolveDelete,
  resolveGenerateAtVersion,
  resolveLayoutConfig,
  resolveMigrate,
  resolvePurge,
  resolveValidateAtVersion,
} from './options';

describe('dynamodb CLI option resolvers', () => {
  it('resolvers expand flag strings using dotenv syntax', () => {
    const cfg: DynamodbPluginConfig = { delete: { tableName: 'CfgName' } };
    const ref = { __GETDOTENV_TEST_TBL__: 'FromEnv' };
    const out = resolveDelete(
      { tableName: '${__GETDOTENV_TEST_TBL__}' },
      cfg,
      ref,
    );
    expect(out.options.tableNameOverride).toEqual('FromEnv');
  });

  it('resolveGenerateAtVersion should merge tableProperties and expand strings', () => {
    // Config is assumed to be interpolated by the host already.
    const cfg: DynamodbPluginConfig = {
      tablesPath: './tables',
      generate: {
        version: '001',
        tableProperties: {
          billingMode: 'PROVISIONED',
          tableName: 'CfgTable',
        },
        clean: false,
      },
    };
    const flags = {
      clean: true,
      tableProperties: {
        readCapacityUnits: '5',
        writeCapacityUnits: '6',
        tableName: '$NAME',
      },
    };
    const ref = { NAME: 'MyTable' };
    const out = resolveGenerateAtVersion(flags, cfg, ref);
    expect(out.version).toEqual('001');
    expect(out.cfg.tablesPath).toEqual('./tables');
    expect(out.options.clean).toEqual(true);
    expect(out.options.tableProperties?.billingMode).toEqual('PROVISIONED');
    expect(out.options.tableProperties?.tableName).toEqual('MyTable');
    expect(out.options.tableProperties?.readCapacityUnits).toEqual('5');
    expect(out.options.tableProperties?.writeCapacityUnits).toEqual('6');
  });

  it('resolveValidateAtVersion should use flags>config precedence for version', () => {
    const cfg: DynamodbPluginConfig = {
      validate: { version: '001' },
    };
    const flags = { version: '002' };
    const out = resolveValidateAtVersion(flags, cfg, {});
    expect(out.version).toEqual('002');
  });

  it('resolveCreateAtVersion should map waiter and tableNameOverride with expansion', () => {
    // Config is assumed to be interpolated by the host already.
    const cfg: DynamodbPluginConfig = {
      create: {
        version: '001',
        waiter: { maxSeconds: 10 },
        tableNameOverride: 'FromCfg',
      },
    };
    const flags = {
      version: '002',
      maxSeconds: 15,
      tableNameOverride: '$NAME2',
      validate: true,
      refreshGenerated: false,
      allowNonLatest: true,
      force: true,
    };
    const ref = { NAME: 'FromCfg', NAME2: 'FromFlags' };
    const out = resolveCreateAtVersion(flags, cfg, ref);
    expect(out.version).toEqual('002');
    expect(out.options.tableNameOverride).toEqual('FromFlags');
    expect(out.options.waiter?.maxWaitTime).toEqual(15);
    expect(out.options.validate).toEqual(true);
    expect(out.options.refreshGenerated).toEqual(false);
    expect(out.options.allowNonLatest).toEqual(true);
    expect(out.options.force).toEqual(true);
  });

  it('resolveDelete should choose flags over config and map waiter seconds', () => {
    // Config is assumed to be interpolated by the host already.
    const cfg: DynamodbPluginConfig = {
      delete: {
        tableName: 'CfgName',
        waiter: { maxSeconds: 5 },
      },
    };
    const flags = {
      tableName: '$TBLFLAGS',
      maxSeconds: '12',
    };
    const ref = { TBLCFG: 'CfgName', TBLFLAGS: 'FlagName' };
    const out = resolveDelete(flags, cfg, ref);
    expect(out.options.tableNameOverride).toEqual('FlagName');
    expect(out.options.waiter?.maxWaitTime).toEqual(12);
  });

  it('resolvePurge should expand table name', () => {
    const cfg: DynamodbPluginConfig = { purge: { tableName: 'CfgTable' } };
    const out = resolvePurge({ tableName: '$NAME' }, cfg, { NAME: 'T' });
    expect(out.options.tableNameOverride).toEqual('T');
  });

  it('resolveLayoutConfig: undefined flag tokens must not clobber config tokens', () => {
    // Callers always construct a tokens object with all three keys even when
    // the CLI flag was not passed. The bug caused undefined flag values to
    // overwrite valid config values after the spread merge.
    const cfg: DynamodbPluginConfig = {
      tokens: {
        table: 'table',
        entityManager: 'entityManager',
        transform: 'transform',
      },
    };
    const flagsWithAllUndefined = {
      tokens: {
        table: undefined,
        entityManager: undefined,
        transform: undefined,
      },
    };
    const result = resolveLayoutConfig(flagsWithAllUndefined, cfg, {});
    expect(result.tokens?.table).toEqual('table');
    expect(result.tokens?.entityManager).toEqual('entityManager');
    expect(result.tokens?.transform).toEqual('transform');
  });

  it('resolveLayoutConfig: defined flag tokens should override config tokens', () => {
    const cfg: DynamodbPluginConfig = {
      tokens: {
        table: 'cfgTable',
        entityManager: 'cfgEm',
        transform: 'cfgTransform',
      },
    };
    const flagsWithOverride = {
      tokens: {
        table: 'flagTable',
        entityManager: undefined,
        transform: undefined,
      },
    };
    const result = resolveLayoutConfig(flagsWithOverride, cfg, {});
    expect(result.tokens?.table).toEqual('flagTable');
    expect(result.tokens?.entityManager).toEqual('cfgEm');
    expect(result.tokens?.transform).toEqual('cfgTransform');
  });

  it('resolveMigrate should merge/expand and coerce numerics', () => {
    // Config is assumed to be interpolated by the host already.
    const cfg: DynamodbPluginConfig = {
      tablesPath: './tables',
      migrate: {
        sourceTable: 'S',
        targetTable: 'T',
        fromVersion: '010',
        toVersion: '020',
        pageSize: 25,
        limit: 1000,
        transformConcurrency: 2,
        progressIntervalMs: 5000,
      },
    };
    const flags = {
      // override a few
      fromVersion: '011',
      pageSize: '50',
    };
    const ref = { SRC: 'S', TGT: 'T' };
    const out = resolveMigrate(flags, cfg, ref);
    expect(out.cfg.tablesPath).toEqual('./tables');
    expect(out.sourceTableName).toEqual('S');
    expect(out.targetTableName).toEqual('T');
    expect(out.fromVersion).toEqual('011');
    expect(out.toVersion).toEqual('020');
    expect(out.pageSize).toEqual(50);
    expect(out.limit).toEqual(1000);
    expect(out.transformConcurrency).toEqual(2);
    expect(out.progressIntervalMs).toEqual(5000);
  });
});
