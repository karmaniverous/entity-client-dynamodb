import type { BatchWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';

import { entityManager, type MyConfigMap } from '../../test/entityManager';
import { EntityClient } from './EntityClient';

type BatchWriteInput = {
  RequestItems: Record<string, Record<string, unknown>[]>;
} & Record<string, unknown>;
interface DocBatchWriteSpy {
  batchWrite: (input: BatchWriteInput) => Promise<BatchWriteCommandOutput>;
}

describe('EntityClient - batch requeue on UnprocessedItems', () => {
  const makeClient = () =>
    new EntityClient<MyConfigMap>({
      entityManager,
      region: 'local',
      tableName: 'RequeueTable',
    });

  it('requeues unprocessed items for putItems', async () => {
    const client = makeClient();
    const tableName = client.tableName;

    // Spy & stub batchWrite to simulate UnprocessedItems on first call only.
    const calls: {
      RequestItems: Record<string, Record<string, unknown>[]>;
    }[] = [];

    const docSpy = client.doc as unknown as DocBatchWriteSpy;
    const original = docSpy.batchWrite.bind(client.doc);
    docSpy.batchWrite = async (input: BatchWriteInput) => {
      // satisfy require-await while keeping behavior
      await Promise.resolve();
      const req = input;
      calls.push(req);

      // Half of the current batch is "unprocessed" on the first call only.
      const batch = req.RequestItems[tableName] ?? [];
      const half = Math.ceil(batch.length / 2);
      const unprocessed = calls.length === 1 ? batch.slice(0, half) : [];

      const out: BatchWriteCommandOutput = {
        $metadata: { httpStatusCode: 200 },
        ...(unprocessed.length
          ? { UnprocessedItems: { [tableName]: unprocessed } }
          : {}),
      };

      return out;
    };

    try {
      const items = [
        { hashKey2: 'H', rangeKey: 'a' },
        { hashKey2: 'H', rangeKey: 'b' },
        { hashKey2: 'H', rangeKey: 'c' },
        { hashKey2: 'H', rangeKey: 'd' },
      ];

      const outputs = await client.putItems(items);

      // Expect at least two calls due to requeue of unprocessed items.
      expect(calls.length).to.be.greaterThan(1);
      // Outputs should reflect each batchWrite call.
      expect(outputs.length).to.equal(calls.length);

      // First call included the full batch; second call received the requeued half.
      const first = calls[0].RequestItems[tableName] ?? [];
      const second = calls[1].RequestItems[tableName] ?? [];
      expect(second.length).to.equal(Math.ceil(first.length / 2));

      // Sanity: UnprocessedItems are cleared by the second call.
      outputs.forEach((o, i) => {
        if (i === 0) {
          expect(
            o.UnprocessedItems?.[tableName]?.length ?? 0,
          ).to.be.greaterThan(0);
        } else {
          expect(o.UnprocessedItems?.[tableName]).to.be.undefined;
        }
      });
    } finally {
      // Restore original
      docSpy.batchWrite = original;
    }
  });

  it('requeues unprocessed items for deleteItems', async () => {
    const client = makeClient();
    const tableName = client.tableName;

    const calls: {
      RequestItems: Record<string, Record<string, unknown>[]>;
    }[] = [];

    const docSpy = client.doc as unknown as DocBatchWriteSpy;
    const original = docSpy.batchWrite.bind(client.doc);
    docSpy.batchWrite = async (input: BatchWriteInput) => {
      // satisfy require-await while keeping behavior
      await Promise.resolve();
      const req = input;
      calls.push(req);

      const batch = req.RequestItems[tableName] ?? [];
      const half = Math.ceil(batch.length / 2);
      const unprocessed = calls.length === 1 ? batch.slice(0, half) : [];

      const out: BatchWriteCommandOutput = {
        $metadata: { httpStatusCode: 200 },
        ...(unprocessed.length
          ? { UnprocessedItems: { [tableName]: unprocessed } }
          : {}),
      };

      return out;
    };

    try {
      const keys = [
        { hashKey2: 'H', rangeKey: 'a' },
        { hashKey2: 'H', rangeKey: 'b' },
        { hashKey2: 'H', rangeKey: 'c' },
      ];

      const outputs = await client.deleteItems(keys);

      expect(calls.length).to.be.greaterThan(1);
      expect(outputs.length).to.equal(calls.length);

      const first = calls[0].RequestItems[tableName] ?? [];
      const second = calls[1].RequestItems[tableName] ?? [];
      expect(second.length).to.equal(Math.ceil(first.length / 2));
    } finally {
      docSpy.batchWrite = original;
    }
  });
});
