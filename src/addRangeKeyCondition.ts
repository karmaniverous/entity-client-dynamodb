import type { Item } from './Item';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export type RangeKeyConditionOperator =
  | '<'
  | '<='
  | '='
  | '>'
  | '>='
  | 'begins_with'
  | 'between';

export interface AddRangeKeyConditionParams {
  indexToken: string;
  item: Item;
  rangeKeyToken: string;
  operator: RangeKeyConditionOperator;
  toItem?: Item;
}

export const addRangeKeyCondition = (
  builder: ShardQueryMapBuilder,
  {
    indexToken,
    item,
    operator,
    rangeKeyToken,
    toItem,
  }: AddRangeKeyConditionParams,
): void => {
  try {
    // Default index map value.
    builder.indexParamsMap[indexToken] ??= {
      expressionAttributeNames: {},
      expressionAttributeValues: {},
      filterConditions: [],
    };

    // No replacement of existing range key condition.
    if (builder.indexParamsMap[indexToken].rangeKeyCondition !== undefined)
      throw new Error('range key condition already exists');

    let rangeKeyCondition: string | undefined;

    if (operator === 'between') {
      if (!toItem)
        throw new Error("toItem is required when operator is 'between'");

      // Process fromItem.
      const fromRangeKeyValue = item[rangeKeyToken] as string | undefined;

      if (fromRangeKeyValue !== undefined)
        builder.indexParamsMap[indexToken].expressionAttributeValues[
          `:${rangeKeyToken}From`
        ] = fromRangeKeyValue;

      // Process toItem.
      const toRangeKeyValue = toItem[rangeKeyToken] as string | undefined;

      if (toRangeKeyValue !== undefined)
        builder.indexParamsMap[indexToken].expressionAttributeValues[
          `:${rangeKeyToken}To`
        ] = toRangeKeyValue;

      // Update rangeKeyCondition.
      if (fromRangeKeyValue !== undefined || toRangeKeyValue !== undefined) {
        rangeKeyCondition =
          fromRangeKeyValue !== undefined && toRangeKeyValue !== undefined
            ? `#${rangeKeyToken} BETWEEN :${rangeKeyToken}From AND :${rangeKeyToken}To`
            : fromRangeKeyValue !== undefined && toRangeKeyValue === undefined
              ? `#${rangeKeyToken} >= :${rangeKeyToken}From`
              : `#${rangeKeyToken} <= :${rangeKeyToken}To`;

        builder.indexParamsMap[indexToken].rangeKeyCondition =
          rangeKeyCondition;
      }

      builder.logger.debug(
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

      builder.indexParamsMap[indexToken].expressionAttributeValues[
        `:${rangeKeyToken}`
      ] = rangeKeyValue;

      if (rangeKeyValue != undefined) {
        rangeKeyCondition =
          operator === 'begins_with'
            ? `${operator}(#${rangeKeyToken}, :${rangeKeyToken})`
            : `#${rangeKeyToken} ${operator} :${rangeKeyToken}`;

        builder.indexParamsMap[indexToken].rangeKeyCondition =
          rangeKeyCondition;
      }

      builder.logger.debug(
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

    // Update expressionAttributeNames.
    if (rangeKeyCondition !== undefined)
      builder.indexParamsMap[indexToken].expressionAttributeNames[
        `#${rangeKeyToken}`
      ] = rangeKeyToken;
  } catch (error) {
    if (error instanceof Error)
      builder.logger.error(error.message, {
        indexToken,
        item,
        rangeKeyToken,
        operator,
        toItem,
      });

    throw error;
  }
};
