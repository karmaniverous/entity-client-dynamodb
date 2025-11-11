import type { PutCommandInput, PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityRecord,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.putItem.
 */
export async function putItem<C extends BaseConfigMap>(
  this: EntityClient<C>,
  itemOrOptions:
    | EntityRecord<C>
    | MakeOptional<
        ReplaceKey<PutCommandInput, 'Item', EntityRecord<C>>,
        'TableName'
      >,
  options: MakeOptional<Omit<PutCommandInput, 'Item'>, 'TableName'> = {},
): Promise<PutCommandOutput> {
  // Resolve options.
  const { hashKey, rangeKey } = this.entityManager.config;

  const resolvedOptions = {
    TableName: this.tableName,
    ...(hashKey in itemOrOptions && rangeKey in itemOrOptions
      ? {
          Item: itemOrOptions as EntityRecord<C>,
        }
      : itemOrOptions),
    ...options,
  } as ReplaceKey<PutCommandInput, 'Item', EntityRecord<C>>;

  try {
    // Send command.
    const response = await this.doc.put(resolvedOptions);

    // Evaluate response.
    if (response.$metadata.httpStatusCode === 200)
      this.logger.debug('put item to table', {
        itemOrOptions,
        options,
        resolvedOptions,
        response,
      });
    else {
      const msg = 'failed to put item to table';
      this.logger.error(msg, response);
      throw new Error(msg);
    }

    return response;
  } catch (error) {
    if (error instanceof Error)
      this.logger.error(error.message, { itemOrOptions, options });

    throw error;
  }
}
