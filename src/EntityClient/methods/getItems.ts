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
export async function getItems<C extends BaseConfigMap>(
  client: EntityClient<C>,
  keys: EntityKey<C>[],
  attributesOrOptions?: string[] | import('../BatchGetOptions').BatchGetOptions,
  maybeOptions?: import('../BatchGetOptions').BatchGetOptions,
): Promise<{
  items: EMEntityRecord<C, EntityToken<C>>[];
  outputs: BatchGetCommandOutput[];
}> {
  const hasAttributes = Array.isArray(attributesOrOptions);
  const attributes = hasAttributes ? attributesOrOptions : undefined;

  const resolvedOptions: import('../BatchGetOptions').BatchGetOptions =
    hasAttributes ? (maybeOptions ?? {}) : (attributesOrOptions ?? {});

  const { tableName, batchProcessOptions, ...input } = {
    tableName: client.tableName,
    ...resolvedOptions,
  } as import('../BatchGetOptions').BatchGetOptions;

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
          [tableName!]: {
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
      output.UnprocessedKeys?.[tableName!]?.Keys as EntityKey<C>[];

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
      tableName,
      batchProcessOptions,
      input,
      outputs,
    });

    return {
      items: outputs.flatMap(
        (output) => output.Responses?.[tableName!] ?? [],
      ) as EMEntityRecord<C, EntityToken<C>>[],
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
