import type { BaseConfigMap, EntityKey } from '@karmaniverous/entity-manager';
import { pick } from 'radash';

import type { BatchWriteOptions } from '../BatchWriteOptions';
import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.purgeItems.
 */
export async function purgeItems<C extends BaseConfigMap>(
  this: EntityClient<C>,
  options: BatchWriteOptions = {},
): Promise<number> {
  try {
    // Resolve options.
    const { tableName, ...batchWriteOptions }: BatchWriteOptions = {
      tableName: this.tableName,
      ...options,
    };

    let purged = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
    const { hashKey, rangeKey } = this.entityManager.config;

    do {
      const scanOut = await this.doc.scan({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      });
      const items = (scanOut.Items ?? []) as Record<string, unknown>[];
      lastEvaluatedKey = scanOut.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;

      if (items.length) {
        const itemKeys = items.map((item) =>
          pick(item, [hashKey, rangeKey]),
        ) as EntityKey<C>[];

        await this.deleteItems(itemKeys, {
          tableName,
          ...batchWriteOptions,
        });

        purged += items.length;
      }
    } while (lastEvaluatedKey);

    this.logger.debug('purged items from table', {
      options,
      tableName,
      batchWriteOptions,
      purged,
    });

    return purged;
  } catch (error) {
    if (error instanceof Error) this.logger.error(error.message, { options });

    throw error;
  }
}
