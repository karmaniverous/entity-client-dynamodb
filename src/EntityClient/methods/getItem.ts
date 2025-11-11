import type { GetCommandInput, GetCommandOutput } from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityKey,
  EntityRecord,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';
import { zipToObject } from 'radash';

import type { EntityClient } from '../EntityClient';

/**
 * Helper implementation for EntityClient.getItem.
 */
export async function getItem<C extends BaseConfigMap>(
  this: EntityClient<C>,
  keyOrOptions: EntityKey<C> | MakeOptional<GetCommandInput, 'TableName'>,
  attributesOrOptions?:
    | string[]
    | MakeOptional<Omit<GetCommandInput, 'Key'>, 'TableName'>,
  options?: MakeOptional<
    Omit<
      GetCommandInput,
      | 'AttributesToGet'
      | 'ExpressionAttributeNames'
      | 'Key'
      | 'ProjectionExpression'
    >,
    'TableName'
  >,
): Promise<ReplaceKey<GetCommandOutput, 'Item', EntityRecord<C> | undefined>> {
  // Resolve options.
  const { hashKey, rangeKey } = this.entityManager.config;

  const { AttributesToGet: attributes, ...resolvedOptions } = {
    TableName: this.tableName,
    ...(hashKey in keyOrOptions && rangeKey in keyOrOptions
      ? { Key: keyOrOptions as EntityKey<C> }
      : keyOrOptions),
    ...(Array.isArray(attributesOrOptions)
      ? { AttributesToGet: attributesOrOptions }
      : attributesOrOptions),
    ...options,
  } as ReplaceKey<GetCommandInput, 'Key', EntityKey<C>>;

  const attributeExpressions = attributes?.map((a) => `#${a}`);

  const input: ReplaceKey<GetCommandInput, 'Key', EntityKey<C>> = {
    ...(attributes && attributeExpressions
      ? {
          ExpressionAttributeNames: zipToObject(
            attributeExpressions,
            attributes,
          ),
          ProjectionExpression: attributeExpressions.join(','),
        }
      : {}),
    ...resolvedOptions,
  };

  try {
    const output = (await this.doc.get(input)) as ReplaceKey<
      GetCommandOutput,
      'Item',
      EntityRecord<C> | undefined
    >;

    this.logger.debug('got item from table', {
      keyOrOptions,
      attributesOrOptions,
      options,
      attributes,
      resolvedOptions,
      attributeExpressions,
      input,
      output,
    });

    return output;
  } catch (error) {
    if (error instanceof Error)
      this.logger.error(error.message, {
        keyOrOptions,
        attributesOrOptions,
        options,
      });

    throw error;
  }
}
