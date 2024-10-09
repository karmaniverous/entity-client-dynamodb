import {
  type EntityMap,
  type Exactify,
  type ItemMap,
  type PartialTranscodable,
  type ShardQueryFunction,
  type ShardQueryMap,
  ShardQueryMapBuilder,
  type ShardQueryResult,
  TranscodableProperties,
  type TranscodeMap,
} from '@karmaniverous/entity-manager';
import { mapValues } from 'radash';

import {
  addRangeKeyCondition,
  type RangeKeyConditionOperator,
} from './addRangeKeyCondition';
import type { DynamoDbShardQueryMapBuilderOptions } from './DynamoDbShardQueryMapBuilderOptions';
import { getDynamoDbDocumentQueryArgs } from './getDynamoDbDocumentQueryArgs';

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
      expressionAttributeNames: Record<string, string | undefined>;
      expressionAttributeValues: Record<string, string | undefined>;
      filterConditions: (string | undefined)[];
      rangeKeyCondition?: string;
    }
  > = {};

  get indexMap() {
    return this.#indexMap;
  }

  #getShardQueryFunction(
    indexToken: string,
  ): ShardQueryFunction<Item, EntityToken, M, HashKey, RangeKey, T> {
    return async (
      hashKey: string,
      pageKey?: PartialTranscodable<Item, T>,
      pageSize?: number,
    ) => {
      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.options.dynamoDbEntityManagerClient.doc.query(
        getDynamoDbDocumentQueryArgs(
          this,
          indexToken,
          hashKey,
          pageKey,
          pageSize,
        ),
      );

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

  addRangeKeyCondition(
    indexToken: string,
    rangeKeyToken: TranscodableProperties<Item, T>,
    operator: RangeKeyConditionOperator,
    item: Partial<Item>,
  ): this;
  addRangeKeyCondition(
    indexToken: string,
    rangeKeyToken: TranscodableProperties<Item, T>,
    operator: RangeKeyConditionOperator,
    fromItem: Partial<Item>,
    toItem: Partial<Item>,
  ): this;
  addRangeKeyCondition(
    indexToken: string,
    rangeKeyToken: TranscodableProperties<Item, T>,
    operator: RangeKeyConditionOperator,
    itemOrFromItem: Partial<Item>,
    toItem?: Partial<Item>,
  ): this {
    return addRangeKeyCondition(
      this,
      indexToken,
      rangeKeyToken,
      operator,
      itemOrFromItem,
      toItem,
    ) as this;
  }
}
