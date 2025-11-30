import type {
  DeleteCommandInput,
  DeleteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityKey,
  EntityRecord as EMEntityRecord,
  EntityToken,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.deleteItem.
 */
export async function deleteItem<C extends BaseConfigMap>(
  client: EntityClient<C>,
  keyOrOptions:
    | EntityKey<C>
    | MakeOptional<
        ReplaceKey<DeleteCommandInput, 'Key', EntityKey<C>>,
        'TableName'
      >,
  options: MakeOptional<Omit<DeleteCommandInput, 'Key'>, 'TableName'> = {},
): Promise<DeleteCommandOutput> {
  // Resolve options.
  const { hashKey, rangeKey } = client.entityManager.config;

  const resolvedOptions = {
    TableName: client.tableName,
    ...(hashKey in keyOrOptions && rangeKey in keyOrOptions
      ? {
          Key: keyOrOptions as EMEntityRecord<C, EntityToken<C>>,
        }
      : keyOrOptions),
    ...options,
  } as ReplaceKey<DeleteCommandInput, 'Key', EMEntityRecord<C, EntityToken<C>>>;

  try {
    // Send command.
    const response = await client.doc.delete(resolvedOptions);

    // Evaluate response.
    if (response.$metadata.httpStatusCode === 200)
      client.logger.debug('deleted item from table', {
        keyOrOptions,
        options,
        resolvedOptions,
        response,
      });
    else {
      const msg = 'failed to delete item from table';
      client.logger.error(msg, response);
      throw new Error(msg);
    }

    return response;
  } catch (error) {
    if (error instanceof Error)
      client.logger.error(error.message, { keyOrOptions, options });

    throw error;
  }
}
