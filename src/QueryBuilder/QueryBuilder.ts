import {
  type BaseConfigMap,
  BaseQueryBuilder,
  type EntityItemByToken,
  type EntityToken,
  type IndexRangeKeyOf,
  type PageKeyByIndex,
  type ProjectedItemByToken,
  type QueryBuilderQueryOptions,
  type QueryResult,
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
  K = unknown,
> extends BaseQueryBuilder<C, EntityClient<C>, IndexParams, ET, ITS, CF, K> {
  getShardQueryFunction(
    indexToken: ITS,
  ): ShardQueryFunction<C, ET, ITS, CF, K> {
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

      const result: ShardQueryResult<C, ET, ITS, CF, K> = {
        count,
        // K-aware: project item shape when a projection K is supplied.
        items: items as unknown as ProjectedItemByToken<C, ET, K>[],
      };

      if (newPageKey) {
        (result as { pageKey?: PageKeyByIndex<C, ET, ITS, CF> }).pageKey =
          newPageKey as PageKeyByIndex<C, ET, ITS, CF>;
      }

      return result;
    };

    return fn as unknown as ShardQueryFunction<C, ET, ITS, CF, K>;
  }

  /**
   * Adds a range key condition to a {@link ShardQueryMap | `ShardQueryMap`} index.
   * See the {@link RangeKeyCondition | `RangeKeyCondition`} type for more info.
   *
   * @param indexToken - The index token.
   * @param condition - The {@link RangeKeyCondition | `RangeKeyCondition`} object.
   *
   * @returns - The modified {@link ShardQueryMap | `ShardQueryMap`} instance.
   */
  addRangeKeyCondition(
    indexToken: ITS,
    condition: RangeKeyCondition & {
      // CF-aware narrowing: when CF carries indexes and ITS is constrained to those keys,
      // property narrows to that index's rangeKey token; otherwise falls back to string.
      // Use an IfNever-style non-distributive conditional so that `never`
      // falls back to `string` when CF is absent.
      property: [IndexRangeKeyOf<CF, ITS>] extends [never]
        ? string
        : IndexRangeKeyOf<CF, ITS>;
    },
  ): this {
    // Narrow builder variance at helper boundary to avoid generic incompatibility.
    // Helper only relies on indexParamsMap and entityClient logger.
    addRangeKeyCondition(this as unknown as QueryBuilder<C>, indexToken, {
      ...(condition as unknown as Record<string, unknown>),
    } as never);
    return this;
  }

  /**
   * Set a projection (attributes) for an index token.
   * - Type-only: narrows K when called with a const tuple.
   * - Runtime: populates ProjectionExpression for the index.
   *
   * Note: At query time, uniqueProperty and any explicit sort keys will be
   * auto-included to preserve dedupe/sort invariants.
   */
  setProjection<KAttr extends readonly string[]>(
    indexToken: ITS,
    attributes: KAttr,
  ): QueryBuilder<C, ET, ITS, CF, KAttr> {
    // Ensure params map entry

    this.indexParamsMap[indexToken] ??= {
      expressionAttributeNames: {},
      expressionAttributeValues: {},
      filterConditions: [],
    };
    const current = this.indexParamsMap[indexToken].projectionAttributes ?? [];
    const next = Array.from(new Set<string>([...current, ...attributes]));
    this.indexParamsMap[indexToken].projectionAttributes = next;
    // Type-channel cast to carry K
    return this as unknown as QueryBuilder<C, ET, ITS, CF, KAttr>;
  }

  /**
   * Override query to auto-include uniqueProperty and any explicit sort keys
   * when projections are present (preserves dedupe/sort invariants).
   */
  async query(
    options: QueryBuilderQueryOptions<C, CF>,
  ): Promise<QueryResult<C, ET, ITS, K>> {
    const uniqueProperty =
      this.entityClient.entityManager.config.entities[this.entityToken]
        ?.uniqueProperty;
    const sortKeys = (options.sortOrder ?? []).map((s) => s.property as string);
    for (const indexToken of Object.keys(this.indexParamsMap) as ITS[]) {
      const params = this.indexParamsMap[indexToken];
      const attrs = params.projectionAttributes;
      if (attrs?.length) {
        const extras = [uniqueProperty, ...sortKeys].filter(
          (x): x is string => !!x,
        );
        params.projectionAttributes = Array.from(
          new Set<string>([...attrs, ...extras]),
        );
      }
    }
    return super.query(options) as unknown as Promise<
      QueryResult<C, ET, ITS, K>
    >;
  }

  /**
   * Adds a filter condition to a {@link ShardQueryMap | `ShardQueryMap`} index. See the {@link FilterCondition | `FilterCondition`} type for more info.
   *
   * @param indexToken - The index token.
   * @param condition - The {@link FilterCondition | `FilterCondition`} object.
   *
   * @returns - The modified {@link ShardQueryMap | `ShardQueryMap`} instance.
   */
  addFilterCondition(indexToken: ITS, condition: FilterCondition<C>): this {
    // Narrow builder variance at helper boundary to avoid generic incompatibility.
    // Helper only relies on indexParamsMap and entityClient logger.
    addFilterCondition(
      this as unknown as QueryBuilder<C>,
      indexToken,
      condition as never,
    );
    return this;
  }
}
