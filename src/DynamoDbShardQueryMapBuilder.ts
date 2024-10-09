import {
  type ClientShardQueryFunction,
  type ClientShardQueryMap,
  ShardQueryMapBuilder,
} from '@karmaniverous/entity-manager';
import { mapValues } from 'radash';

import {
  addRangeKeyCondition,
  type RangeKeyConditionOperator,
} from './addRangeKeyCondition';
import type { DynamoDbShardQueryMapBuilderOptions } from './DynamoDbShardQueryMapBuilderOptions';
import { getDynamoDbDocumentQueryArgs } from './getDynamoDbDocumentQueryArgs';
import { Item } from './Item';

export class DynamoDbShardQueryMapBuilder extends ShardQueryMapBuilder<DynamoDbShardQueryMapBuilderOptions> {
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

  #getShardQueryFunction(indexToken: string): ClientShardQueryFunction {
    return async (hashKey: string, pageKey?: Item, pageSize?: number) => {
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

      return { count, items, pageKey: newPageKey };
    };
  }

  getShardQueryMap(): ClientShardQueryMap {
    return mapValues(this.#indexMap, (indexConfig, indexToken) =>
      this.#getShardQueryFunction(indexToken),
    );
  }

  addRangeKeyCondition(
    indexToken: string,
    rangeKeyToken: string,
    operator: Omit<RangeKeyConditionOperator, 'between'>,
  ): this;
  addRangeKeyCondition(
    indexToken: string,
    rangeKeyToken: string,
    operator: 'between',
    toItem: Item,
  ): this;
  addRangeKeyCondition(
    indexToken: string,
    rangeKeyToken: string,
    operator: RangeKeyConditionOperator,
    toItem?: Item,
  ): this {
    return addRangeKeyCondition(
      this,
      indexToken,
      rangeKeyToken,
      operator,
      toItem,
    ) as this;
  }
}
