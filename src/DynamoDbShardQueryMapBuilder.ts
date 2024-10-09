import {
  type EntityMap,
  type Exactify,
  type ItemMap,
  type PartialTranscodable,
  type ShardQueryFunction,
  type ShardQueryMap,
  ShardQueryMapBuilder,
  type ShardQueryResult,
  type TranscodeMap,
} from '@karmaniverous/entity-manager';
import { mapValues } from 'radash';

import type { DynamoDbShardQueryMapBuilderOptions } from './DynamoDbShardQueryMapBuilderOptions';

export class DynamoDbShardQueryMapBuilder<
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> extends ShardQueryMapBuilder<
  Item,
  EntityToken,
  M,
  HashKey,
  RangeKey,
  T,
  DynamoDbShardQueryMapBuilderOptions<
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  >
> {
  #indexMap: Record<
    string,
    {
      expressionAttributeNames: Record<string, string>;
      expressionAttributeValues: Record<string, string>;
      filterConditions: string[];
      rangeKeyCondition?: string;
    }
  > = {};

  #getShardQueryFunction(
    indexToken: string,
  ): ShardQueryFunction<Item, EntityToken, M, HashKey, RangeKey, T> {
    return async (
      hashKey: string,
      pageKey?: PartialTranscodable<Item, T>,
      pageSize?: number,
    ) => {
      const {
        expressionAttributeNames,
        expressionAttributeValues,
        filterConditions,
        rangeKeyCondition,
      } = this.#indexMap[indexToken];

      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.options.dynamoDbEntityManagerClient.doc.query({
        ExclusiveStartKey: pageKey,
        ExpressionAttributeNames: {
          [`#${this.options.hashKeyToken}`]: `:${this.options.hashKeyToken}`,
          ...expressionAttributeNames,
        },
        ExpressionAttributeValues: {
          [`#${this.options.hashKeyToken}`]: hashKey,
          ...expressionAttributeValues,
        },
        ...(filterConditions.length
          ? { FilterExpression: filterConditions.join(' AND ') }
          : {}),
        IndexName: indexToken,
        KeyConditionExpression: [
          `#${this.options.hashKeyToken} = :${this.options.hashKeyToken}`,
          ...(rangeKeyCondition ? [rangeKeyCondition] : []),
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

  getShardQueryMap(): ShardQueryMap<
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  > {
    return mapValues(this.#indexMap, (indexConfig, indexToken) =>
      this.#getShardQueryFunction(indexToken),
    );
  }
}
