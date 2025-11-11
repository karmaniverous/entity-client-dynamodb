import type { BaseConfigMap, EntityKey } from '@karmaniverous/entity-manager';
import { pick } from 'radash';

import type { BatchWriteOptions } from '../BatchWriteOptions';
import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.purgeItems.
 */
export async function purgeItems<C extends BaseConfigMap>(
  client: EntityClient<C>,
  options: BatchWriteOptions = {},
): Promise<number> {
  try {
    // Resolve options.
    const { tableName, ...batchWriteOptions }: BatchWriteOptions = {
      tableName: client.tableName,
      ...options,
    };

    let purged = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
    const { hashKey, rangeKey } = client.entityManager.config;

    do {
      const scanOut = await client.doc.scan({
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

        await client.deleteItems(itemKeys, {
          tableName,
          ...batchWriteOptions,
        });

        purged += items.length;
      }
    } while (lastEvaluatedKey);

    client.logger.debug('purged items from table', {
      options,
      tableName,
      batchWriteOptions,
      purged,
    });

    return purged;
  } catch (error) {
    if (error instanceof Error) client.logger.error(error.message, { options });

    throw error;
  }
}
