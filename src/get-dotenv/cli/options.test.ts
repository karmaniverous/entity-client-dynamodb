import { describe, expect, it } from 'vitest';

import type { DynamodbPluginConfig } from './options';
import {
  dotenvExpandLocal,
  resolveCreateAtVersion,
  resolveDelete,
  resolveGenerateAtVersion,
  resolveMigrate,
  resolvePurge,
  resolveValidateAtVersion,
} from './options';

describe('dynamodb CLI option resolvers', () => {
  it('dotenvExpandLocal should expand $VAR and ${VAR:default}', () => {
    const ref = { FOO: 'bar' };
    expect(dotenvExpandLocal('x$FOO', ref)).toEqual('xbar');
    expect(dotenvExpandLocal('x${FOO}', ref)).toEqual('xbar');
    expect(dotenvExpandLocal('x${MISSING:ok}', ref)).toEqual('xok');
    expect(dotenvExpandLocal('x$MISSING:ok', ref)).toEqual('xok');
  });

  it('resolveGenerateAtVersion should merge overlays and expand strings', () => {
    const cfg: DynamodbPluginConfig = {
      tablesPath: './tables',
      generate: {
        version: '001',
        overlays: {
          billingMode: 'PAY_PER_REQUEST',
          tableName: '$NAME',
        },
      },
    };
    const flags = {
      overlays: {
        readCapacityUnits: '5',
        writeCapacityUnits: '6',
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
    const cfg: DynamodbPluginConfig = {
      create: {
        version: '001',
        waiter: { maxSeconds: 10 },
        tableNameOverride: '$NAME',
      },
    };
    const flags = {
      version: '002',
      maxSeconds: 15,
      tableNameOverride: '$NAME2',
      validate: true,
      refreshGenerated: false,
      force: true,
    };
    const ref = { NAME: 'FromCfg', NAME2: 'FromFlags' };
    const out = resolveCreateAtVersion(flags, cfg, ref);
    expect(out.version).toEqual('002');
    expect(out.options.tableNameOverride).toEqual('FromFlags');
    expect(out.options.waiter?.maxWaitTime).toEqual(15);
    expect(out.options.validate).toEqual(true);
    expect(out.options.refreshGenerated).toEqual(false);
    expect(out.options.force).toEqual(true);
  });

  it('resolveDelete should choose flags over config and map waiter seconds', () => {
    const cfg: DynamodbPluginConfig = {
      delete: {
        tableName: '$TBLCFG',
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
    const cfg: DynamodbPluginConfig = { purge: { tableName: '$NAME' } };
    const out = resolvePurge({}, cfg, { NAME: 'T' });
    expect(out.options.tableNameOverride).toEqual('T');
  });

  it('resolveMigrate should merge/expand and coerce numerics', () => {
    const cfg: DynamodbPluginConfig = {
      tablesPath: './tables',
      migrate: {
        sourceTable: '$SRC',
        targetTable: '$TGT',
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
