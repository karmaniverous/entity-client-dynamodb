import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import {
  type ShardQueryFunction,
  type ShardQueryMap,
} from '@karmaniverous/entity-manager';
import { mapValues } from 'radash';

import {
  addRangeKeyCondition,
  type AddRangeKeyConditionParams,
} from './addRangeKeyCondition';
import { getDocumentQueryArgs } from './getDocumentQueryArgs';
import type { IndexParams } from './IndexParams';
import type { Item } from './Item';

export interface ShardQueryMapBuilderOptions {
  doc: DynamoDBDocument;

  hashKeyToken: string;

  /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
  logger?: Pick<Console, 'debug' | 'error'>;

  /** Dehydrated page key from the previous query data page. */
  pageKey?: string;

  tableName: string;
}
export class ShardQueryMapBuilder {
  readonly doc: ShardQueryMapBuilderOptions['doc'];
  readonly hashKeyToken: ShardQueryMapBuilderOptions['hashKeyToken'];
  readonly indexParamsMap: Record<string, IndexParams> = {};
  readonly logger: NonNullable<ShardQueryMapBuilderOptions['logger']>;
  readonly pageKey: ShardQueryMapBuilderOptions['pageKey'];
  readonly tableName: ShardQueryMapBuilderOptions['tableName'];

  constructor({
    doc,
    hashKeyToken,
    logger = console,
    pageKey,
    tableName,
  }: ShardQueryMapBuilderOptions) {
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

  getShardQueryMap(): ShardQueryMap<Item> {
    return mapValues(this.indexParamsMap, (indexConfig, indexToken) =>
      this.#getShardQueryFunction(indexToken),
    );
  }

  addRangeKeyCondition(params: AddRangeKeyConditionParams): this {
    addRangeKeyCondition(this, params);
    return this;
  }
}
