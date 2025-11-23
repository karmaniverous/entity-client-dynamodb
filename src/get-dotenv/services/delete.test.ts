import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import { describe, expect, it, vi } from 'vitest';

import type { EntityClient } from '../../EntityClient/EntityClient';
import { deleteTable, purgeTable } from './delete';

type AnyClient = EntityClient<BaseConfigMap>;

describe('get-dotenv delete/purge service wrappers', function () {
  it('deleteTable should pass TableName override and waiter', async function () {
    const deleteSpy = vi.fn(async (_opts?: unknown, _waiter?: unknown) => {
      // satisfy require-await and mark params used
      void _opts;
      void _waiter;
      await Promise.resolve();
      return { waiterResult: { state: 'SUCCESS' as const } };
    });

    const client = { deleteTable: deleteSpy } as unknown as AnyClient;

    const waiter = { maxWaitTime: 1 };
    const out = await deleteTable(client, {
      tableNameOverride: 'MyTable',
      waiter,
    });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    const [optsArg, waiterArg] = deleteSpy.mock.calls[0] as [unknown, unknown];
    expect(optsArg).to.deep.equal({ TableName: 'MyTable' });
    expect(waiterArg).to.deep.equal(waiter);
    expect(
      (out as { waiterResult?: { state?: string } }).waiterResult?.state,
    ).to.equal('SUCCESS');
  });

  it('deleteTable should accept defaults when no options are provided', async function () {
    const deleteSpy = vi.fn(async (_opts?: unknown, _waiter?: unknown) => {
      void _opts;
      void _waiter;
      await Promise.resolve();
      return { waiterResult: { state: 'SUCCESS' as const } };
    });
    const client = { deleteTable: deleteSpy } as unknown as AnyClient;
    await deleteTable(client);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    const [optsArg] = deleteSpy.mock.calls[0] as [unknown];
    expect(optsArg).to.deep.equal({});
  });

  it('purgeTable should pass tableName override and return purged count', async function () {
    const purgeSpy = vi.fn(async (_opts?: unknown) => {
      void _opts;
      await Promise.resolve();
      return 42;
    });

    const client = { purgeItems: purgeSpy } as unknown as AnyClient;
    const count = await purgeTable(client, {
      tableNameOverride: 'TargetTable',
      // Pass through a valid BatchWriteOptions field to ensure threading.
      // BatchWriteCommandInput supports ReturnConsumedCapacity: 'INDEXES' | 'TOTAL' | 'NONE'
      // (typed via AWS SDK). This is a safe placeholder for pass-through verification.
      // Cast to satisfy literal typing in tests without importing AWS types here.
      ReturnConsumedCapacity: 'TOTAL' as unknown as never,
    });

    expect(count).to.equal(42);
    expect(purgeSpy).toHaveBeenCalledTimes(1);
    const [optsArg] = purgeSpy.mock.calls[0] as [unknown];
    expect(optsArg).to.deep.equal({
      tableName: 'TargetTable',
      ReturnConsumedCapacity: 'TOTAL',
    });
  });
});
