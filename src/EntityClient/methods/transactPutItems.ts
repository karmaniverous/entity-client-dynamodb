import type { TransactWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityRecord as EMEntityRecord,
  EntityToken,
} from '@karmaniverous/entity-manager';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.transactPutItems.
 */
export async function transactPutItems<C extends BaseConfigMap>(
  client: EntityClient<C>,
  items: EMEntityRecord<C, EntityToken<C>>[],
): Promise<TransactWriteCommandOutput> {
  try {
    const output = await client.doc.transactWrite({
      TransactItems: items.map((item) => ({
        Put: { Item: item, TableName: client.tableName },
      })),
    });

    client.logger.debug('put items to table as transaction', { items, output });

    return output;
  } catch (error) {
    if (error instanceof Error) client.logger.error(error.message, { items });

    throw error;
  }
}
