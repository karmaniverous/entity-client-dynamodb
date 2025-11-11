import type { TransactWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityRecord,
} from '@karmaniverous/entity-manager';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.transactPutItems.
 */
export async function transactPutItems<C extends BaseConfigMap>(
  this: EntityClient<C>,
  items: EntityRecord<C>[],
): Promise<TransactWriteCommandOutput> {
  try {
    const output = await this.doc.transactWrite({
      TransactItems: items.map((item) => ({
        Put: { Item: item, TableName: this.tableName },
      })),
    });

    this.logger.debug('put items to table as transaction', { items, output });

    return output;
  } catch (error) {
    if (error instanceof Error) this.logger.error(error.message, { items });

    throw error;
  }
}
