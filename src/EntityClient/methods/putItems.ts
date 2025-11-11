import type { BatchWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import { batchProcess } from '@karmaniverous/batch-process';
import type {
  BaseConfigMap,
  EntityRecord,
} from '@karmaniverous/entity-manager';

import type { BatchWriteOptions } from '../BatchWriteOptions';
import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.putItems.
 */
export async function putItems<C extends BaseConfigMap>(
  this: EntityClient<C>,
  items: EntityRecord<C>[],
  options: BatchWriteOptions = {},
): Promise<BatchWriteCommandOutput[]> {
  // Resolve options.
  const { tableName, batchProcessOptions, ...input }: BatchWriteOptions = {
    tableName: this.tableName,
    ...options,
  };

  try {
    const batchHandler = async (batch: EntityRecord<C>[]) =>
      await this.doc.batchWrite({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
        ...input,
      });

    const unprocessedItemExtractor = (output: BatchWriteCommandOutput) => {
      const unprocessed = output.UnprocessedItems?.[tableName] ?? [];
      return unprocessed.flatMap((wr) => {
        // DocumentClient returns WriteRequest[] with PutRequest/DeleteRequest.
        // Re-queue original items only.
        const asAny = wr as unknown as {
          PutRequest?: { Item?: EntityRecord<C> };
        };
        return asAny.PutRequest?.Item ? [asAny.PutRequest.Item] : [];
      });
    };

    const outputs = await batchProcess(items, {
      batchHandler,
      unprocessedItemExtractor,
      ...Object.assign({}, this.batchProcessOptions, batchProcessOptions),
    });

    this.logger.debug('put items to table', {
      items,
      options,
      tableName,
      batchProcessOptions,
      input,
      outputs,
    });

    return outputs;
  } catch (error) {
    if (error instanceof Error)
      this.logger.error(error.message, { items, options });

    throw error;
  }
}
