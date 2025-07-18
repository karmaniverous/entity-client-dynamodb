import {
  type BaseConfigMap,
  BaseQueryBuilder,
  type EntityItem,
  type PageKey,
  type ShardQueryFunction,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ShardQueryMap, // imported to support API docs
} from '@karmaniverous/entity-manager';

import { EntityClient } from '../EntityClient';
import { getDocumentQueryArgs } from '../EntityClient/getDocumentQueryArgs';
import { addFilterCondition, type FilterCondition } from './addFilterCondition';
import {
  addRangeKeyCondition,
  type RangeKeyCondition,
} from './addRangeKeyCondition';
import type { IndexParams } from './IndexParams';

/**
 * Provides a fluent API for building a {@link ShardQueryMap | `ShardQueryMap`} using a DynamoDB Document client.
 *
 * @category QueryBuilder
 */
export class QueryBuilder<C extends BaseConfigMap> extends BaseQueryBuilder<
  C,
  EntityClient<C>,
  IndexParams
> {
  getShardQueryFunction(indexToken: string): ShardQueryFunction<C> {
    return async (hashKey: string, pageKey?: PageKey<C>, pageSize?: number) => {
      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.entityClient.doc.query(
        getDocumentQueryArgs<C>({
          hashKey,
          hashKeyToken: this.hashKeyToken,
          indexParamsMap: this.indexParamsMap,
          indexToken,
          pageKey,
          pageSize,
          tableName: this.entityClient.tableName,
        }),
      );

      return {
        count,
        items: items as EntityItem<C>[],
        pageKey: newPageKey as PageKey<C>,
      };
    };
  }

  /**
   * Adds a range key condition to a {@link ShardQueryMap | `ShardQueryMap`} index. See the {@link RangeKeyCondition | `RangeKeyCondition`} type for more info.
   *
   * @param indexToken - The index token.
   * @param condition - The {@link RangeKeyCondition | `RangeKeyCondition`} object.
   *
   * @returns - The modified {@link ShardQueryMap | `ShardQueryMap`} instance.
   */
  addRangeKeyCondition(indexToken: string, condition: RangeKeyCondition): this {
    addRangeKeyCondition(this, indexToken, condition);
    return this;
  }

  /**
   * Adds a filter condition to a {@link ShardQueryMap | `ShardQueryMap`} index.  See the {@link FilterCondition | `FilterCondition`} type for more info.
   *
   * @param indexToken - The index token.
   * @param condition - The {@link FilterCondition | `FilterCondition`} object.
   *
   * @returns - The modified {@link ShardQueryMap | `ShardQueryMap`} instance.
   */
  addFilterCondition(indexToken: string, condition: FilterCondition<C>): this {
    addFilterCondition(this, indexToken, condition);
    return this;
  }
}
