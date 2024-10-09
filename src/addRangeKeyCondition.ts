import { DynamoDbShardQueryMapBuilder } from './DynamoDbShardQueryMapBuilder';
import { Item } from './Item';

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

export const addRangeKeyCondition = (
  dynamoDbShardQueryMapBuilder: DynamoDbShardQueryMapBuilder,
  indexToken: string,
  rangeKeyToken: string,
  operator: RangeKeyConditionOperator,
  toItem?: Item,
): typeof dynamoDbShardQueryMapBuilder => {
  try {
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
      const fromRangeKeyValue = dynamoDbShardQueryMapBuilder.options.item[
        rangeKeyToken
      ] as string | undefined;

      dynamoDbShardQueryMapBuilder.indexMap[
        indexToken
      ].expressionAttributeValues[`:${rangeKeyToken}From`] = fromRangeKeyValue;

      // Process toItem.
      const toRangeKeyValue = toItem[rangeKeyToken] as string | undefined;

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
          fromItem: dynamoDbShardQueryMapBuilder.options.item,
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
      const rangeKeyValue = dynamoDbShardQueryMapBuilder.options.item[
        rangeKeyToken
      ] as string | undefined;

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
          item: dynamoDbShardQueryMapBuilder.options.item,
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
          toItem,
        },
      );

    throw error;
  }
};
