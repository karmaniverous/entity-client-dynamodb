import {
  type EntityMap,
  type Exactify,
  type ItemMap,
  type PartialTranscodable,
  type ShardQueryFunction,
  ShardQueryFunctionBuilder,
  ShardQueryResult,
  type TranscodeMap,
} from '@karmaniverous/entity-manager';

import type { DynamoDbShardQueryFunctionBuilderOptions } from './DynamoDbShardQueryFunctionBuilderOptions';

export class DynamoDbShardQueryFunctionBuilder<
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> extends ShardQueryFunctionBuilder<
  Item,
  EntityToken,
  M,
  HashKey,
  RangeKey,
  T,
  DynamoDbShardQueryFunctionBuilderOptions<
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  >
> {
  #expressionAttributeNames: Record<string, string> = {};
  #expressionAttributeValues: Record<string, string> = {};
  #filterConditions: string[] = [];
  #rangeKeyCondition: string | undefined;

  getShardQueryFunction(): ShardQueryFunction<
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  > {
    return async (
      hashKey: string,
      pageKey?: PartialTranscodable<Item, T>,
      pageSize?: number,
    ) => {
      const {
        Count: count,
        Items: items,
        LastEvaluatedKey: newPageKey,
      } = await this.options.dynamoDbEntityManagerClient.doc.query({
        ExclusiveStartKey: pageKey,
        ExpressionAttributeNames: {
          [`#${this.options.hashKeyToken}`]: `:${this.options.hashKeyToken}`,
          ...this.#expressionAttributeNames,
        },
        ExpressionAttributeValues: {
          [`#${this.options.hashKeyToken}`]: hashKey,
          ...this.#expressionAttributeValues,
        },
        ...(this.#filterConditions.length
          ? { FilterExpression: this.#filterConditions.join(' AND ') }
          : {}),
        IndexName: this.options.indexToken,
        KeyConditionExpression: [
          `#${this.options.hashKeyToken} = :${this.options.hashKeyToken}`,
          ...(this.#rangeKeyCondition ? [this.#rangeKeyCondition] : []),
        ].join(' AND '),
        ...(pageSize ? { Limit: pageSize } : {}),
        ScanIndexForward: this.options.scanIndexForward,
        TableName: this.options.tableName,
      });

      return { count, items, pageKey: newPageKey } as ShardQueryResult<
        Item,
        EntityToken,
        M,
        HashKey,
        RangeKey,
        T
      >;
    };
  }
}
