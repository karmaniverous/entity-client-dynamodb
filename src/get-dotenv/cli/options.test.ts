import { describe, expect, it } from 'vitest';

import type { DynamodbPluginConfig } from './options';
import {
  resolveCreateAtVersion,
  resolveDelete,
  resolveGenerateAtVersion,
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

  it('resolveGenerateAtVersion should merge overlays and expand strings', () => {
    // Config is assumed to be interpolated by the host already.
    const cfg: DynamodbPluginConfig = {
      tablesPath: './tables',
      generate: {
        version: '001',
        overlays: {
          billingMode: 'PAY_PER_REQUEST',
          tableName: 'CfgTable',
        },
      },
    };
    const flags = {
      overlays: {
        readCapacityUnits: '5',
        writeCapacityUnits: '6',
        tableName: '$NAME',
      },
    };
    const ref = { NAME: 'MyTable' };
    const out = resolveGenerateAtVersion(flags, cfg, ref);
    expect(out.version).toEqual('001');
    expect(out.cfg.tablesPath).toEqual('./tables');
    expect(out.options.overlays?.BillingMode).toEqual('PAY_PER_REQUEST');
    expect(out.options.overlays?.TableName).toEqual('MyTable');
    expect(out.options.overlays?.ProvisionedThroughput).toEqual({
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 6,
    });
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
