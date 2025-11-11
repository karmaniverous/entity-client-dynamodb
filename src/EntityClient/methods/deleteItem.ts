import type {
  DeleteCommandInput,
  DeleteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityKey,
  EntityRecord,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.deleteItem.
 */
export async function deleteItem<C extends BaseConfigMap>(
  this: EntityClient<C>,
  keyOrOptions:
    | EntityKey<C>
    | MakeOptional<
        ReplaceKey<DeleteCommandInput, 'Key', EntityKey<C>>,
        'TableName'
      >,
  options: MakeOptional<Omit<DeleteCommandInput, 'Key'>, 'TableName'> = {},
): Promise<DeleteCommandOutput> {
  // Resolve options.
  const { hashKey, rangeKey } = this.entityManager.config;

  const resolvedOptions = {
    TableName: this.tableName,
    ...(hashKey in keyOrOptions && rangeKey in keyOrOptions
      ? {
          Key: keyOrOptions as EntityRecord<C>,
        }
      : keyOrOptions),
    ...options,
  } as ReplaceKey<DeleteCommandInput, 'Key', EntityRecord<C>>;

  try {
    // Send command.
    const response = await this.doc.delete(resolvedOptions);

    // Evaluate response.
    if (response.$metadata.httpStatusCode === 200)
      this.logger.debug('deleted item from table', {
        keyOrOptions,
        options,
        resolvedOptions,
        response,
      });
    else {
      const msg = 'failed to delete item from table';
      this.logger.error(msg, response);
      throw new Error(msg);
    }

    return response;
  } catch (error) {
    if (error instanceof Error)
      this.logger.error(error.message, { keyOrOptions, options });

    throw error;
  }
}
