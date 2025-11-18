import {
  type BaseConfigMap,
  BaseQueryBuilder,
  type EntityItemByToken,
  type EntityToken,
  type IndexRangeKeyOf,
  type PageKeyByIndex,
  type ShardQueryFunction,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ShardQueryMap, // imported to support API docs
  type ShardQueryResult,
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
export class QueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C> = EntityToken<C>,
  ITS extends string = string,
  CF = unknown,
> extends BaseQueryBuilder<C, EntityClient<C>, IndexParams, ET, ITS, CF> {
  getShardQueryFunction(indexToken: ITS): ShardQueryFunction<C, ET, ITS, CF> {
    const fn = async (
      hashKey: string,
      pageKey?: PageKeyByIndex<C, ET, ITS, CF>,
      pageSize?: number,
    ) => {
      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.entityClient.doc.query(
        getDocumentQueryArgs<C, ET, ITS, CF>({
          hashKey,
          hashKeyToken: this.hashKeyToken,
          indexParamsMap: this.indexParamsMap,
          indexToken,
          pageKey,
          pageSize,
          tableName: this.entityClient.tableName,
        }),
      );

      const result: ShardQueryResult<C, ET, ITS, CF> = {
        count,
        items: items as EntityItemByToken<C, ET>[],
      };

      if (newPageKey) {
        (result as { pageKey?: PageKeyByIndex<C, ET, ITS, CF> }).pageKey =
          newPageKey as PageKeyByIndex<C, ET, ITS, CF>;
      }

      return result;
    };

    return fn as unknown as ShardQueryFunction<C, ET, ITS, CF>;
  }

  /**
   * Adds a range key condition to a {@link ShardQueryMap | `ShardQueryMap`} index. See the {@link RangeKeyCondition | `RangeKeyCondition`} type for more info.
   *
   * @param indexToken - The index token.
   * @param condition - The {@link RangeKeyCondition | `RangeKeyCondition`} object.
   *
   * @returns - The modified {@link ShardQueryMap | `ShardQueryMap`} instance.
   */
  // Overload: CF-aware narrowing of the property (subset of implementation)
  addRangeKeyCondition(
    indexToken: ITS,
    condition: Omit<RangeKeyCondition, 'property'> & {
      // If CF carries indexes and ITS is constrained to those keys,
      // property narrows to the index rangeKey token union; otherwise
      // this resolves to never and the general overload applies.
      property: IndexRangeKeyOf<CF, ITS>;
    },
  ): this;
  // General signature: preserves original type for implementation
  addRangeKeyCondition(indexToken: ITS, condition: RangeKeyCondition): this;
  addRangeKeyCondition(indexToken: ITS, condition: RangeKeyCondition): this {
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
  addFilterCondition(indexToken: ITS, condition: FilterCondition<C>): this {
    addFilterCondition(this, indexToken, condition);
    return this;
  }
}
