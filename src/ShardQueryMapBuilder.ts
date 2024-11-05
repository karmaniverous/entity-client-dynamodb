import {
  BaseShardQueryMapBuilder,
  type EntityManager,
  type EntityMap,
  type ItemMap,
  type ShardQueryFunction,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ShardQueryMap,
} from '@karmaniverous/entity-manager';
import type {
  Exactify,
  PropertiesOfType,
  TranscodeMap,
} from '@karmaniverous/entity-tools';

import { addFilterCondition, type FilterCondition } from './addFilterCondition';
import {
  addRangeKeyCondition,
  type RangeKeyCondition,
} from './addRangeKeyCondition';
import { EntityClient } from './EntityClient';
import { getDocumentQueryArgs } from './getDocumentQueryArgs';
import type { IndexParams } from './IndexParams';

/**
 * Provides a fluent API for building a {@link ShardQueryMap | `ShardQueryMap`} using a DynamoDB Document client.
 *
 * @category ShardQueryMapBuilder
 */
export class ShardQueryMapBuilder<
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> extends BaseShardQueryMapBuilder<
  IndexParams,
  Item,
  EntityToken,
  M,
  HashKey,
  RangeKey,
  T
> {
  /** ShardQueryMapBuilder constructor. */
  constructor(
    public readonly entityClient: EntityClient,
    public readonly tableName: string,
    entityManager: EntityManager<M, HashKey, RangeKey, T>,
    entityToken: EntityToken,
    hashKeyToken: PropertiesOfType<M[EntityToken], never> | HashKey,
    pageKeyMap?: string,
  ) {
    super(entityManager, entityToken, hashKeyToken, pageKeyMap);
  }

  getShardQueryFunction(indexToken: string): ShardQueryFunction<Item> {
    return async (
      hashKey: string,
      pageKey?: Partial<Item>,
      pageSize?: number,
    ) => {
      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.entityClient.doc.query(
        getDocumentQueryArgs<Item, EntityToken, M, HashKey, RangeKey>({
          hashKey,
          hashKeyToken: this.hashKeyToken,
          indexParamsMap: this.indexParamsMap,
          indexToken,
          pageKey,
          pageSize,
          tableName: this.tableName,
        }),
      );

      return {
        count,
        items: items as Item[],
        pageKey: newPageKey as Partial<Item>,
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
  addFilterCondition(
    indexToken: string,
    condition: FilterCondition<Item, EntityToken, M, HashKey, RangeKey, T>,
  ): this {
    addFilterCondition(this, indexToken, condition);
    return this;
  }
}
