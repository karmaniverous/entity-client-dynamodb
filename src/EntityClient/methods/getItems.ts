import type { BatchGetCommandOutput } from '@aws-sdk/lib-dynamodb';
import { batchProcess } from '@karmaniverous/batch-process';
import type {
  BaseConfigMap,
  EntityKey,
  EntityRecord as EMEntityRecord,
  EntityToken,
} from '@karmaniverous/entity-manager';
import { zipToObject } from 'radash';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.getItems.
 */
export async function getItems<
  C extends BaseConfigMap,
  ET extends EntityToken<C> = EntityToken<C>,
>(
  client: EntityClient<C>,
  keys: EntityKey<C>[],
  attributesOrOptions?:
    | readonly string[]
    | import('../BatchGetOptions').BatchGetOptions,
  maybeOptions?: import('../BatchGetOptions').BatchGetOptions,
): Promise<{
  items: EMEntityRecord<C, ET>[];
  outputs: BatchGetCommandOutput[];
}> {
  const hasAttributes = Array.isArray(attributesOrOptions);
  const attributes = hasAttributes
    ? Array.from(attributesOrOptions)
    : undefined;

  const resolvedOptions: import('../BatchGetOptions').BatchGetOptions =
    hasAttributes ? (maybeOptions ?? {}) : (attributesOrOptions ?? {});

  const { tableName, batchProcessOptions, ...input } = {
    tableName: client.tableName,
    ...resolvedOptions,
  } as import('../BatchGetOptions').BatchGetOptions;
  // Effective table name for downstream lookups and request keys
  const tableNameKey = tableName ?? client.tableName;

  // Prepare projection expression if attributes provided.
  const attributeExpressions = attributes?.length
    ? attributes.map((a) => `#${a}`)
    : undefined;

  const expressionAttributeNames =
    attributes && attributeExpressions
      ? zipToObject(attributeExpressions, attributes)
      : undefined;

  try {
    const batchHandler = async (batch: EntityKey<C>[]) =>
      await client.doc.batchGet({
        RequestItems: {
          [tableNameKey]: {
            Keys: batch,
            ...(attributes && attributeExpressions
              ? {
                  ExpressionAttributeNames: expressionAttributeNames,
                  ProjectionExpression: attributeExpressions.join(','),
                }
              : {}),
          },
        },
        ...input,
      });

    const unprocessedItemExtractor = (output: BatchGetCommandOutput) =>
      output.UnprocessedKeys?.[tableNameKey]?.Keys as EntityKey<C>[];

    const outputs = await batchProcess(keys, {
      batchHandler,
      unprocessedItemExtractor,
      ...Object.assign({}, client.batchProcessOptions, batchProcessOptions),
    });

    client.logger.debug('got items from table', {
      keys,
      options: resolvedOptions,
      attributes,
      expressionAttributeNames,
      attributeExpressions,
      tableName: tableNameKey,
      batchProcessOptions,
      input,
      outputs,
    });

    return {
      items: outputs.flatMap(
        (output) => output.Responses?.[tableNameKey] ?? [],
      ) as EMEntityRecord<C, ET>[],
      outputs,
    };
  } catch (error) {
    if (error instanceof Error)
      client.logger.error(error.message, {
        keys,
        attributesOrOptions,
        options: resolvedOptions,
      });

    throw error;
  }
}
