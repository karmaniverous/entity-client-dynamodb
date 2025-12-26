import type { GetCommandInput, GetCommandOutput } from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityKey,
  EntityRecord as EMEntityRecord,
  EntityToken,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';
import { zipToObject } from 'radash';

import type { EntityClient } from '../EntityClient';

const isReadonlyStringArray = (v: unknown): v is readonly string[] =>
  Array.isArray(v);

/**
 * Helper implementation for EntityClient.getItem.
 */
export async function getItem<
  C extends BaseConfigMap,
  ET extends EntityToken<C> = EntityToken<C>,
>(
  client: EntityClient<C>,
  keyOrOptions: EntityKey<C> | MakeOptional<GetCommandInput, 'TableName'>,
  attributesOrOptions?:
    | readonly string[]
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
): Promise<
  ReplaceKey<GetCommandOutput, 'Item', EMEntityRecord<C, ET> | undefined>
> {
  // Resolve options.
  const { hashKey, rangeKey } = client.entityManager.config;

  const extraOptions =
    !isReadonlyStringArray(attributesOrOptions) && attributesOrOptions
      ? attributesOrOptions
      : undefined;

  const mergedOptions = {
    TableName: client.tableName,
    ...(hashKey in keyOrOptions && rangeKey in keyOrOptions
      ? { Key: keyOrOptions as EntityKey<C> }
      : keyOrOptions),
    ...(extraOptions ?? {}),
    ...(options ?? {}),
  } as ReplaceKey<GetCommandInput, 'Key', EntityKey<C>>;

  const { AttributesToGet: attrsFromObject, ...resolvedOptions } =
    mergedOptions;
  const attributes: string[] | undefined = isReadonlyStringArray(
    attributesOrOptions,
  )
    ? Array.from(attributesOrOptions)
    : attrsFromObject;

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
    const output = (await client.doc.get(input)) as ReplaceKey<
      GetCommandOutput,
      'Item',
      EMEntityRecord<C, ET> | undefined
    >;

    client.logger.debug('got item from table', {
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
      client.logger.error(error.message, {
        keyOrOptions,
        attributesOrOptions,
        options,
      });

    throw error;
  }
}
