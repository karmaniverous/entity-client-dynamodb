import type { BatchWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import { batchProcess } from '@karmaniverous/batch-process';
import type { BaseConfigMap, EntityKey } from '@karmaniverous/entity-manager';

import type { BatchWriteOptions } from '../BatchWriteOptions';
import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.deleteItems.
 */
export async function deleteItems<C extends BaseConfigMap>(
  client: EntityClient<C>,
  keys: EntityKey<C>[],
  options: BatchWriteOptions = {},
): Promise<BatchWriteCommandOutput[]> {
  // Resolve options.
  const {
    tableName,
    batchProcessOptions,
    ...batchWritecommandInput
  }: BatchWriteOptions = {
    tableName: client.tableName,
    ...options,
  };

  try {
    const batchHandler = async (batch: EntityKey<C>[]) =>
      await client.doc.batchWrite({
        RequestItems: {
          [tableName]: batch.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
        ...batchWritecommandInput,
      });

    const unprocessedItemExtractor = (output: BatchWriteCommandOutput) => {
      const unprocessed = output.UnprocessedItems?.[tableName] ?? [];
      return unprocessed.flatMap((wr) => {
        const asAny = wr as unknown as {
          DeleteRequest?: { Key?: EntityKey<C> };
        };
        return asAny.DeleteRequest?.Key ? [asAny.DeleteRequest.Key] : [];
      });
    };

    const outputs = await batchProcess(keys, {
      batchHandler,
      unprocessedItemExtractor,
      ...Object.assign({}, client.batchProcessOptions, batchProcessOptions),
    });

    client.logger.debug('deleted keys from table', {
      keys,
      options,
      tableName,
      batchProcessOptions,
      batchWritecommandInput,
      outputs,
    });

    return outputs;
  } catch (error) {
    if (error instanceof Error)
      client.logger.error(error.message, { keys, options });

    throw error;
  }
}
