import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import type {
  ShardQueryFunction,
  ShardQueryMap,
} from '@karmaniverous/entity-manager';
import type { Entity } from '@karmaniverous/entity-tools';
import { mapValues } from 'radash';

import { addFilterCondition, type FilterCondition } from './addFilterCondition';
import {
  addRangeKeyCondition,
  type RangeKeyCondition,
} from './addRangeKeyCondition';
import { getDocumentQueryArgs } from './getDocumentQueryArgs';
import type { IndexParams } from './IndexParams';

/**
 * Options for {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} constructor.
 *
 * @category ShardQueryMapBuilder
 */
export interface ShardQueryMapBuilderOptions<Item extends Entity> {
  /** DynamoDB Document client. Normally you will be using {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} with an {@link EntityClient | `EntityClient`} instance, so use its {@link EntityClient.doc | `doc`} property. */
  doc: DynamoDBDocument;

  /** The hash key token that defines the partition of the query. All `indexToken` values referenced in following {@link ShardQueryMapBuilder.addRangeKeyCondition | `addRangeKeyCondition`} and {@link ShardQueryMapBuilder.addFilterCondition | `addFilterCondition`} calls should reference indexes that include `hashKeyToken`. */
  hashKeyToken: keyof Item & string;

  /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
  logger?: Pick<Console, 'debug' | 'error'>;

  /** Dehydrated page key from the previous query data page. */
  pageKey?: string;

  /** Table name. */
  tableName: string;
}

/**
 * Provides a fluent API for building a {@link ShardQueryMap | `ShardQueryMap`} using a DynamoDB Document client.
 *
 * @category ShardQueryMapBuilder
 */
export class ShardQueryMapBuilder<Item extends Entity> {
  readonly doc: ShardQueryMapBuilderOptions<Item>['doc'];
  readonly hashKeyToken: ShardQueryMapBuilderOptions<Item>['hashKeyToken'];

  /**
   * Maps `indexToken` values to conditions added with {@link ShardQueryMapBuilder.addRangeKeyCondition | `addRangeKeyCondition`} and {@link ShardQueryMapBuilder.addFilterCondition | `addFilterCondition`}. Visible to enhance testability but should not normally be accessed directly.
   *
   * @protected
   */
  readonly indexParamsMap: Record<string, IndexParams> = {};

  /** Logger object passed in {@link ShardQueryMapBuilderOptions.logger | `ShardQueryMapBuilderOptions`}. */
  readonly logger: NonNullable<ShardQueryMapBuilderOptions<Item>['logger']>;

  /** Dehydrated page key passed in {@link ShardQueryMapBuilderOptions.pageKey | `ShardQueryMapBuilderOptions`}. */
  readonly pageKey: ShardQueryMapBuilderOptions<Item>['pageKey'];

  /** Table name passed in {@link ShardQueryMapBuilderOptions.tableName | `ShardQueryMapBuilderOptions`}. */
  readonly tableName: ShardQueryMapBuilderOptions<Item>['tableName'];

  /** ShardQueryMapBuilder constructor. */
  constructor(options: ShardQueryMapBuilderOptions<Item>) {
    const { doc, hashKeyToken, logger = console, pageKey, tableName } = options;

    this.doc = doc;
    this.hashKeyToken = hashKeyToken;
    this.logger = logger;
    this.pageKey = pageKey;
    this.tableName = tableName;
  }

  #getShardQueryFunction(indexToken: string): ShardQueryFunction<Item> {
    return async (
      hashKey: string,
      pageKey?: Partial<Item>,
      pageSize?: number,
    ) => {
      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.doc.query(
        getDocumentQueryArgs({
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
  addFilterCondition(indexToken: string, condition: FilterCondition): this {
    addFilterCondition(this, indexToken, condition);
    return this;
  }

  /**
   * Builds a {@link ShardQueryMap | `ShardQueryMap`} object. Filter conditions created by multiple {@link ShardQueryMapBuilder.addFilterCondition | `addFilterCondition`} calls are combined with an `AND` operator.
   *
   * @returns - The {@link ShardQueryMap | `ShardQueryMap`} object.
   */
  build(): ShardQueryMap<Item> {
    return mapValues(this.indexParamsMap, (indexConfig, indexToken) =>
      this.#getShardQueryFunction(indexToken),
    );
  }
}
