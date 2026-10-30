import type { BatchWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';

import { entityManager, type MyConfigMap } from '../../../test/entityManager';
import { EntityClient } from '../EntityClient';

interface ScanInput {
  TableName?: string;
  ExclusiveStartKey?: unknown;
}

interface ScanOutput {
  Items?: Record<string, unknown>[];
  LastEvaluatedKey?: Record<string, unknown>;
}

interface DocScanSpy {
  scan: (input: ScanInput) => Promise<ScanOutput>;
}

const makeClient = () =>
  new EntityClient<MyConfigMap>({
    entityManager,
    region: 'local',
    tableName: 'PurgeTable',
  });

/** Serve the given scan pages in order and record the scan inputs. */
const stubPages = (
  client: EntityClient<MyConfigMap>,
  pages: ScanOutput[],
): ScanInput[] => {
  const scans: ScanInput[] = [];
  const doc = client.doc as unknown as DocScanSpy;

  doc.scan = (input) => {
    scans.push(input);

    const page = pages[scans.length - 1] as ScanOutput | undefined;

    if (!page) throw new Error('unexpected scan');

    return Promise.resolve(page);
  };

  return scans;
};

/** Record every delete batch instead of writing to DynamoDB. */
const stubDeletes = (client: EntityClient<MyConfigMap>) => {
  const deletes: { keys: unknown[]; options: unknown }[] = [];

  client.deleteItems = (keys, options) => {
    deletes.push({ keys, options });

    return Promise.resolve([] as BatchWriteCommandOutput[]);
  };

  return deletes;
};

describe('EntityClient - purgeItems excludeKeys', () => {
  it('keeps excluded keys and counts only the deleted items', async () => {
    const client = makeClient();

    stubPages(client, [
      {
        Items: [
          { hashKey2: 'config', rangeKey: '0', created: 1 },
          { hashKey2: 'user', rangeKey: '1', created: 1 },
          { hashKey2: 'user', rangeKey: '2', created: 1 },
        ],
      },
    ]);

    const deletes = stubDeletes(client);

    const purged = await client.purgeItems({
      excludeKeys: [{ hashKey2: 'config', rangeKey: '0' }],
    });

    expect(purged).toBe(2);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.keys).toEqual([
      { hashKey2: 'user', rangeKey: '1' },
      { hashKey2: 'user', rangeKey: '2' },
    ]);
  });

  it('ignores attribute order in an excluded key', async () => {
    const client = makeClient();

    stubPages(client, [{ Items: [{ hashKey2: 'config', rangeKey: '0' }] }]);

    const deletes = stubDeletes(client);

    const purged = await client.purgeItems({
      excludeKeys: [{ rangeKey: '0', hashKey2: 'config' }],
    });

    expect(purged).toBe(0);
    expect(deletes).toHaveLength(0);
  });

  it('matches a numeric key value against its string form', async () => {
    const client = makeClient();

    stubPages(client, [{ Items: [{ hashKey2: 'config', rangeKey: 0 }] }]);

    const deletes = stubDeletes(client);

    const purged = await client.purgeItems({
      excludeKeys: [{ hashKey2: 'config', rangeKey: '0' }],
    });

    expect(purged).toBe(0);
    expect(deletes).toHaveLength(0);
  });

  it('applies the exclusion on every page', async () => {
    const client = makeClient();

    const scans = stubPages(client, [
      {
        Items: [
          { hashKey2: 'config', rangeKey: '0' },
          { hashKey2: 'user', rangeKey: '1' },
        ],
        LastEvaluatedKey: { hashKey2: 'user', rangeKey: '1' },
      },
      {
        Items: [
          { hashKey2: 'config', rangeKey: '0' },
          { hashKey2: 'user', rangeKey: '2' },
        ],
      },
    ]);

    const deletes = stubDeletes(client);

    const purged = await client.purgeItems({
      excludeKeys: [{ hashKey2: 'config', rangeKey: '0' }],
    });

    expect(scans).toHaveLength(2);
    expect(scans[1]?.ExclusiveStartKey).toEqual({
      hashKey2: 'user',
      rangeKey: '1',
    });
    expect(purged).toBe(2);
    expect(deletes.map(({ keys }) => keys)).toEqual([
      [{ hashKey2: 'user', rangeKey: '1' }],
      [{ hashKey2: 'user', rangeKey: '2' }],
    ]);
  });

  it('skips the delete call when every scanned item is excluded', async () => {
    const client = makeClient();

    stubPages(client, [
      {
        Items: [
          { hashKey2: 'config', rangeKey: '0' },
          { hashKey2: 'purge', rangeKey: '0' },
        ],
      },
    ]);

    const deletes = stubDeletes(client);

    const purged = await client.purgeItems({
      excludeKeys: [
        { hashKey2: 'config', rangeKey: '0' },
        { hashKey2: 'purge', rangeKey: '0' },
      ],
    });

    expect(purged).toBe(0);
    expect(deletes).toHaveLength(0);
  });

  it('rejects excluded keys that do not match the key attributes', async () => {
    for (const excludeKeys of [
      'hashKey2',
      {},
      [{ hashKey2: 'config' }],
      [{ hashKey2: 'config', rangeKey: '0', created: 1 }],
      [[{ hashKey2: 'config', rangeKey: '0' }]],
    ]) {
      const client = makeClient();

      stubPages(client, [{ Items: [{ hashKey2: 'config', rangeKey: '0' }] }]);

      const deletes = stubDeletes(client);

      await expect(
        client.purgeItems({
          excludeKeys: excludeKeys as unknown as {
            hashKey2: string;
            rangeKey: string;
          }[],
        }),
        `expected ${JSON.stringify(excludeKeys)} to be rejected`,
      ).rejects.toThrow(/^excludeKeys/);

      expect(deletes).toHaveLength(0);
    }
  });
});
