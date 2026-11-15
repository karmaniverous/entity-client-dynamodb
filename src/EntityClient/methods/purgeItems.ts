import type { BaseConfigMap, EntityKey } from '@karmaniverous/entity-manager';
import { pick } from 'radash';

import type { BatchWriteOptions } from '../BatchWriteOptions';
import type { EntityClient } from '../EntityClient';
import type { PurgeItemsOptions } from '../PurgeItemsOptions';

/**
 * Render a key as a comparable string.
 *
 * Scanned items and caller-supplied excluded keys are both reduced to this
 * token, so attribute order does not matter and a number matches its string
 * form (`0` matches `'0'`).
 *
 * @param key - Key (or scanned item) to render.
 * @param attributes - Key attributes, in table order.
 * @returns A stable string token.
 */
const keyToken = (key: Record<string, unknown>, attributes: string[]): string =>
  JSON.stringify(attributes.map((attribute) => String(key[attribute])));

/**
 * Helper implementation for EntityClient.purgeItems.
 */
export async function purgeItems<C extends BaseConfigMap>(
  client: EntityClient<C>,
  options: PurgeItemsOptions<C> = {},
): Promise<number> {
  try {
    // Resolve options.
    const { excludeKeys = [], ...rest } = options;

    const { tableName, ...batchWriteOptions }: BatchWriteOptions = {
      tableName: client.tableName,
      ...rest,
    };

    const { hashKey, rangeKey } = client.entityManager.config;
    const keyAttributes = [hashKey, rangeKey];

    // An excluded key that does not line up with the table's key attributes
    // would match nothing and purge the record the caller meant to keep, so it
    // is rejected rather than ignored.
    const expected = [...keyAttributes].sort().join(', ');

    if (!Array.isArray(excludeKeys))
      throw new Error(
        `excludeKeys must be an array of entity keys: ${JSON.stringify(excludeKeys)}`,
      );

    for (const candidate of excludeKeys as unknown[]) {
      const entry = candidate as Record<string, unknown>;

      if (
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        Object.keys(entry).sort().join(', ') !== expected
      )
        throw new Error(
          `excludeKeys entry must carry exactly ${expected}: ${JSON.stringify(entry)}`,
        );
    }

    const excluded = new Set(
      excludeKeys.map((key) => keyToken(key, keyAttributes)),
    );

    let purged = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

    do {
      const scanOut = await client.doc.scan({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      });
      const items = (scanOut.Items ?? []) as Record<string, unknown>[];
      lastEvaluatedKey = scanOut.LastEvaluatedKey as
        Record<string, unknown> | undefined;

      if (items.length) {
        const itemKeys = items
          .map((item) => pick(item, keyAttributes) as EntityKey<C>)
          .filter((key) => !excluded.has(keyToken(key, keyAttributes)));

        if (itemKeys.length !== items.length) {
          client.logger.debug('kept excluded items from purge', {
            tableName,
            kept: items.length - itemKeys.length,
          });
        }

        // An empty batch write still costs a call, and some DynamoDB
        // deployments reject it outright.
        if (itemKeys.length) {
          await client.deleteItems(itemKeys, {
            tableName,
            ...batchWriteOptions,
          });

          purged += itemKeys.length;
        }
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
