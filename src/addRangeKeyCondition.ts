import type {
  EntityMap,
  Exactify,
  ItemMap,
  TranscodableProperties,
  TranscodeMap,
} from '@karmaniverous/entity-manager';

import { DynamoDbShardQueryMapBuilder } from './DynamoDbShardQueryMapBuilder';

export type RangeKeyConditionOperator =
  | '='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'begins_with'
  | 'between';

const defaultIndexMapValue = {
  expressionAttributeNames: {},
  expressionAttributeValues: {},
  filterConditions: [],
};

export const addRangeKeyCondition = <
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  dynamoDbShardQueryMapBuilder: DynamoDbShardQueryMapBuilder<
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  >,
  indexToken: string,
  rangeKeyToken: TranscodableProperties<Item, T>,
  operator: RangeKeyConditionOperator,
  itemOrFromItem: Partial<Item>,
  toItem?: Partial<Item>,
): typeof dynamoDbShardQueryMapBuilder => {
  try {
    // Validate params.

    // Default index map value.
    dynamoDbShardQueryMapBuilder.indexMap[indexToken] ??= {
      ...defaultIndexMapValue,
    };

    // Update expressionAttributeNames.
    dynamoDbShardQueryMapBuilder.indexMap[indexToken].expressionAttributeNames[
      `#${rangeKeyToken}`
    ] = rangeKeyToken;

    if (operator === 'between') {
      if (!toItem)
        throw new Error("toItem is required when operator is 'between'");

      // Process fromItem.
      const fromRangeKeyValue =
        dynamoDbShardQueryMapBuilder.options.entityManager.addKeys(
          itemOrFromItem,
          dynamoDbShardQueryMapBuilder.options.entityToken,
          false,
        )[rangeKeyToken];

      dynamoDbShardQueryMapBuilder.indexMap[
        indexToken
      ].expressionAttributeValues[`:${rangeKeyToken}From`] = fromRangeKeyValue;

      // Process toItem.
      const toRangeKeyValue =
        dynamoDbShardQueryMapBuilder.options.entityManager.addKeys(
          toItem,
          dynamoDbShardQueryMapBuilder.options.entityToken,
          false,
        )[rangeKeyToken];

      dynamoDbShardQueryMapBuilder.indexMap[
        indexToken
      ].expressionAttributeValues[`:${rangeKeyToken}To`] = toRangeKeyValue;

      // Update rangeKeyCondition.
      const rangeKeyCondition =
        fromRangeKeyValue !== undefined && toRangeKeyValue !== undefined
          ? `#${rangeKeyToken} BETWEEN :${rangeKeyToken}From AND :${rangeKeyToken}To`
          : fromRangeKeyValue !== undefined && toRangeKeyValue === undefined
            ? `#${rangeKeyToken} >= :${rangeKeyToken}From`
            : fromRangeKeyValue === undefined && toRangeKeyValue !== undefined
              ? `#${rangeKeyToken} <= :${rangeKeyToken}To`
              : undefined;

      dynamoDbShardQueryMapBuilder.indexMap[indexToken].rangeKeyCondition =
        rangeKeyCondition;

      dynamoDbShardQueryMapBuilder.options.dynamoDbEntityManagerClient.options.logger.debug(
        rangeKeyCondition === undefined
          ? 'no range key condition added'
          : 'added range key condition',
        {
          indexToken,
          rangeKeyToken,
          operator,
          fromItem: itemOrFromItem,
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
      const rangeKeyValue =
        dynamoDbShardQueryMapBuilder.options.entityManager.addKeys(
          itemOrFromItem,
          dynamoDbShardQueryMapBuilder.options.entityToken,
          false,
        )[rangeKeyToken];

      dynamoDbShardQueryMapBuilder.indexMap[
        indexToken
      ].expressionAttributeValues[`:${rangeKeyToken}`] = rangeKeyValue;

      const rangeKeyCondition =
        rangeKeyValue === undefined
          ? undefined
          : operator === 'begins_with'
            ? `${operator}(#${rangeKeyToken}, :${rangeKeyToken})`
            : `#${rangeKeyToken} ${operator} :${rangeKeyToken}`;

      dynamoDbShardQueryMapBuilder.indexMap[indexToken].rangeKeyCondition =
        rangeKeyCondition;

      dynamoDbShardQueryMapBuilder.options.dynamoDbEntityManagerClient.options.logger.debug(
        rangeKeyCondition === undefined
          ? 'no range key condition added'
          : 'added range key condition',
        {
          indexToken,
          rangeKeyToken,
          operator,
          item: itemOrFromItem,
          rangeKeyValue,
          rangeKeyCondition,
        },
      );
    }

    return dynamoDbShardQueryMapBuilder;
  } catch (error) {
    if (error instanceof Error)
      dynamoDbShardQueryMapBuilder.options.dynamoDbEntityManagerClient.options.logger.error(
        error.message,
        {
          indexToken,
          rangeKeyToken,
          operator,
          itemOrFromItem,
          toItem,
        },
      );

    throw error;
  }
};
