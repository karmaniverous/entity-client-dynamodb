import {
  type ShardQueryFunction,
  type ShardQueryMap,
  ShardQueryMapBuilder,
} from '@karmaniverous/entity-manager';
import { mapValues } from 'radash';

import type { AddRangeKeyConditionParams } from './AddRangeKeyConditionParams';
import type { DynamoDbShardQueryMapBuilderOptions } from './DynamoDbShardQueryMapBuilderOptions';
import { getDynamoDbDocumentQueryArgs } from './getDynamoDbDocumentQueryArgs';
import type { IndexParams } from './IndexParams';
import type { Item } from './Item';

export const defaultIndexMapValue = {
  expressionAttributeNames: {},
  expressionAttributeValues: {},
  filterConditions: [],
};

export class DynamoDbShardQueryMapBuilder extends ShardQueryMapBuilder<
  Item,
  DynamoDbShardQueryMapBuilderOptions
> {
  #indexParamsMap: Record<string, IndexParams> = {};

  get indexParamsMap() {
    return this.#indexParamsMap;
  }

  constructor({
    logger = console,
    ...options
  }: Omit<DynamoDbShardQueryMapBuilderOptions, 'logger'> &
    Partial<Pick<DynamoDbShardQueryMapBuilderOptions, 'logger'>>) {
    super({ logger, ...options });
  }

  #getShardQueryFunction(indexToken: string): ShardQueryFunction<Item> {
    return async (hashKey: string, pageKey?: Item, pageSize?: number) => {
      const {
        Count: count = 0,
        Items: items = [],
        LastEvaluatedKey: newPageKey,
      } = await this.options.dynamoDBDocument.query(
        getDynamoDbDocumentQueryArgs({
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

  addRangeKeyCondition({
    indexToken,
    item,
    operator,
    rangeKeyToken,
    toItem,
  }: AddRangeKeyConditionParams): this {
    try {
      // Default index map value.
      this.indexParamsMap[indexToken] ??= {
        ...defaultIndexMapValue,
      };

      // Update expressionAttributeNames.
      this.indexParamsMap[indexToken].expressionAttributeNames[
        `#${rangeKeyToken}`
      ] = rangeKeyToken;

      if (operator === 'between') {
        if (!toItem)
          throw new Error("toItem is required when operator is 'between'");

        // Process fromItem.
        const fromRangeKeyValue = item[rangeKeyToken] as string | undefined;

        this.indexParamsMap[indexToken].expressionAttributeValues[
          `:${rangeKeyToken}From`
        ] = fromRangeKeyValue;

        // Process toItem.
        const toRangeKeyValue = toItem[rangeKeyToken] as string | undefined;

        this.indexParamsMap[indexToken].expressionAttributeValues[
          `:${rangeKeyToken}To`
        ] = toRangeKeyValue;

        // Update rangeKeyCondition.
        const rangeKeyCondition =
          fromRangeKeyValue !== undefined && toRangeKeyValue !== undefined
            ? `#${rangeKeyToken} BETWEEN :${rangeKeyToken}From AND :${rangeKeyToken}To`
            : fromRangeKeyValue !== undefined && toRangeKeyValue === undefined
              ? `#${rangeKeyToken} >= :${rangeKeyToken}From`
              : fromRangeKeyValue === undefined && toRangeKeyValue !== undefined
                ? `#${rangeKeyToken} <= :${rangeKeyToken}To`
                : undefined;

        this.indexParamsMap[indexToken].rangeKeyCondition = rangeKeyCondition;

        this.options.logger.debug(
          rangeKeyCondition === undefined
            ? 'no range key condition added'
            : 'added range key condition',
          {
            indexToken,
            item,
            operator,
            rangeKeyToken,
            toItem,
            fromRangeKeyValue,
            toRangeKeyValue,
            rangeKeyCondition,
          },
        );
      } else {
        if (toItem)
          throw new Error("toItem is forbidden when operator is not 'between'");

        // Process item.
        const rangeKeyValue = item[rangeKeyToken] as string | undefined;

        this.indexParamsMap[indexToken].expressionAttributeValues[
          `:${rangeKeyToken}`
        ] = rangeKeyValue;

        const rangeKeyCondition =
          rangeKeyValue === undefined
            ? undefined
            : operator === 'begins_with'
              ? `${operator}(#${rangeKeyToken}, :${rangeKeyToken})`
              : `#${rangeKeyToken} ${operator} :${rangeKeyToken}`;

        this.indexParamsMap[indexToken].rangeKeyCondition = rangeKeyCondition;

        this.options.logger.debug(
          rangeKeyCondition === undefined
            ? 'no range key condition added'
            : 'added range key condition',
          {
            indexToken,
            item,
            rangeKeyToken,
            operator,
            rangeKeyValue,
            rangeKeyCondition,
          },
        );
      }

      return this;
    } catch (error) {
      if (error instanceof Error)
        this.options.logger.error(error.message, {
          indexToken,
          item,
          rangeKeyToken,
          operator,
          toItem,
        });

      throw error;
    }
  }
}
