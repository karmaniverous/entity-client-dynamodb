import type { TransactWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { BaseConfigMap, EntityKey } from '@karmaniverous/entity-manager';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.transactDeleteItems.
 */
export async function transactDeleteItems<C extends BaseConfigMap>(
  this: EntityClient<C>,
  keys: EntityKey<C>[],
): Promise<TransactWriteCommandOutput> {
  try {
    const output = await this.doc.transactWrite({
      TransactItems: keys.map((key) => ({
        Delete: { Key: key, TableName: this.tableName },
      })),
    });

    this.logger.debug('deleted items from table as transaction', {
      keys,
      output,
    });

    return output;
  } catch (error) {
    if (error instanceof Error) this.logger.error(error.message, { keys });

    throw error;
  }
}
