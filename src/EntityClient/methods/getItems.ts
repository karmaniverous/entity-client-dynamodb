import type { BatchGetCommandOutput } from '@aws-sdk/lib-dynamodb';
import { batchProcess } from '@karmaniverous/batch-process';
import type {
  BaseConfigMap,
  EntityKey,
  EntityRecord,
} from '@karmaniverous/entity-manager';

import type { BatchGetOptions } from '../BatchGetOptions';
import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.getItems.
 */
export async function getItems<C extends BaseConfigMap>(
  this: EntityClient<C>,
  keys: EntityKey<C>[],
  options: BatchGetOptions = {},
): Promise<{ items: EntityRecord<C>[]; outputs: BatchGetCommandOutput[] }> {
  // Resolve options.
  const { tableName, batchProcessOptions, ...input }: BatchGetOptions = {
    tableName: this.tableName,
    ...options,
  };

  try {
    const batchHandler = async (batch: EntityKey<C>[]) =>
      await this.doc.batchGet({
        RequestItems: {
          [tableName]: {
            Keys: batch,
          },
        },
        ...input,
      });

    const unprocessedItemExtractor = (output: BatchGetCommandOutput) =>
      output.UnprocessedKeys?.[tableName]?.Keys as EntityKey<C>[];

    const outputs = await batchProcess(keys, {
      batchHandler,
      unprocessedItemExtractor,
      ...Object.assign({}, this.batchProcessOptions, batchProcessOptions),
    });

    this.logger.debug('got items from table', {
      keys,
      options,
      tableName,
      batchProcessOptions,
      input,
      outputs,
    });

    return {
      items: outputs.flatMap(
        (output) => output.Responses?.[tableName] ?? [],
      ) as EntityRecord<C>[],
      outputs,
    };
  } catch (error) {
    if (error instanceof Error)
      this.logger.error(error.message, { keys, options });
    throw error;
  }
}
