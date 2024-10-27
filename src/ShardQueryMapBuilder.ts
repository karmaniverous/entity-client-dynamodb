import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import {
  BaseShardQueryMapBuilder,
  type BaseShardQueryMapBuilderOptions,
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

export interface ShardQueryMapBuilderOptions
  extends BaseShardQueryMapBuilderOptions {
  dynamoDBDocument: DynamoDBDocument;

  /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
  logger: Pick<Console, 'debug' | 'error'>;

  scanIndexForward?: boolean;

  tableName: string;
}
export class ShardQueryMapBuilder extends BaseShardQueryMapBuilder<
  Item,
  ShardQueryMapBuilderOptions
> {
  #indexParamsMap: Record<string, IndexParams> = {};

  get indexParamsMap() {
    return this.#indexParamsMap;
  }

  constructor({
    logger = console,
    ...options
  }: Omit<ShardQueryMapBuilderOptions, 'logger'> &
    Partial<Pick<ShardQueryMapBuilderOptions, 'logger'>>) {
    super({ logger, ...options });
  }

  #getShardQueryFunction(indexToken: string): ShardQueryFunction<Item> {
    return async (hashKey: string, pageKey?: Item, pageSize?: number) => {
      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.options.dynamoDBDocument.query(
        getDocumentQueryArgs({
          hashKey,
          hashKeyToken: this.options.hashKeyToken,
          indexParamsMap: this.#indexParamsMap,
          indexToken,
          pageKey,
          pageSize,
          scanIndexForward: this.options.scanIndexForward,
          tableName: this.options.tableName,
        }),
      );

      return { count, items, pageKey: newPageKey };
    };
  }

  getShardQueryMap(): ShardQueryMap<Item> {
    return mapValues(this.#indexParamsMap, (indexConfig, indexToken) =>
      this.#getShardQueryFunction(indexToken),
    );
  }

  addRangeKeyCondition(params: AddRangeKeyConditionParams): this {
    addRangeKeyCondition(this, params);
    return this;
  }
}
