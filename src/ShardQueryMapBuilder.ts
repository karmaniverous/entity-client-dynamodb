import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import type {
  ShardQueryFunction,
  ShardQueryMap,
} from '@karmaniverous/entity-manager';
import { mapValues } from 'radash';

import { addFilterCondition, type FilterCondition } from './addFilterCondition';
import {
  addRangeKeyCondition,
  type RangeKeyCondition,
} from './addRangeKeyCondition';
import { getDocumentQueryArgs } from './getDocumentQueryArgs';
import type { IndexParams } from './IndexParams';
import type { Item } from './Item';

/**
 * Options for {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} constructor.
 *
 * @category ShardQueryMap Builder
 */
export interface ShardQueryMapBuilderOptions {
  /** DynamoDB Document client. */
  doc: DynamoDBDocument;

  /** Hash key token. */
  hashKeyToken: string;

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
 * @category ShardQueryMap Builder
 */
export class ShardQueryMapBuilder {
  readonly doc: ShardQueryMapBuilderOptions['doc'];
  readonly hashKeyToken: ShardQueryMapBuilderOptions['hashKeyToken'];

  /**
   * About IndexParamsMap.
   *
   * @protected
   */
  readonly indexParamsMap: Record<string, IndexParams> = {};
  readonly logger: NonNullable<ShardQueryMapBuilderOptions['logger']>;
  readonly pageKey: ShardQueryMapBuilderOptions['pageKey'];
  readonly tableName: ShardQueryMapBuilderOptions['tableName'];

  /** ShardQueryMapBuilder constructor. */
  constructor(options: ShardQueryMapBuilderOptions) {
    const { doc, hashKeyToken, logger = console, pageKey, tableName } = options;

    this.doc = doc;
    this.hashKeyToken = hashKeyToken;
    this.logger = logger;
    this.pageKey = pageKey;
    this.tableName = tableName;
  }

  #getShardQueryFunction(indexToken: string): ShardQueryFunction<Item> {
    return async (hashKey: string, pageKey?: Item, pageSize?: number) => {
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

      return { count, items, pageKey: newPageKey };
    };
  }

  /**
   * Adds a range key condition to a {@link ShardQueryMap | `ShardQueryMap`} index.
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
   * Adds a filter condition to a {@link ShardQueryMap | `ShardQueryMap`} index.
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
   * Builds a {@link ShardQueryMap | `ShardQueryMap`} object.
   *
   * @returns - The {@link ShardQueryMap | `ShardQueryMap`} object.
   */
  build(): ShardQueryMap<Item> {
    return mapValues(this.indexParamsMap, (indexConfig, indexToken) =>
      this.#getShardQueryFunction(indexToken),
    );
  }
}
