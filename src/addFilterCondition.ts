import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

import { addQueryConditionBeginsWith } from './addQueryConditionBeginsWith';
import { addQueryConditionBetween } from './addQueryConditionBetween';
import { addQueryConditionComparison } from './addQueryConditionComparison';
import type {
  QueryConditionBeginsWith,
  QueryConditionBetween,
  QueryConditionComparison,
  QueryConditionContains,
  QueryConditionExists,
  QueryConditionGroup,
  QueryConditionIn,
  QueryConditionNot,
} from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

/**
 * Union type of all possible filter conditions.
 */
export type FilterCondition =
  | QueryConditionBeginsWith
  | QueryConditionBetween<Exclude<NativeScalarAttributeValue, object>>
  | QueryConditionComparison<Exclude<NativeScalarAttributeValue, object>>
  | QueryConditionContains<NativeScalarAttributeValue>
  | QueryConditionExists
  | QueryConditionIn<NativeScalarAttributeValue>
  | QueryConditionGroup<FilterCondition>
  | QueryConditionNot<FilterCondition>;

/**
 * Recursively compose condition string and add expression attribute names & values to builder.
 *
 * @param builder - {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} instance.
 * @param indexToken - Index token in {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} `indexParamsMap`.
 * @param condition - {@link FilterCondition | `FilterCondition`} object.
 *
 * @returns - Condition string or `undefined`.
 */
const composeCondition = (
  builder: ShardQueryMapBuilder,
  indexToken: string,
  condition: FilterCondition,
): string | undefined => {
  switch (condition.operator) {
    case 'begins_with':
      return addQueryConditionBeginsWith(builder, indexToken, condition);
    case 'between':
      return addQueryConditionBetween(builder, indexToken, condition);
    case '<':
    case '<=':
    case '=':
    case '>':
    case '>=':
    case '<>':
      return addQueryConditionComparison(builder, indexToken, condition);
    case 'contains':
      throw new Error('not implemented');
    case 'attribute_exists':
    case 'attribute_not_exists':
      throw new Error('not implemented');
    case 'in':
      throw new Error('not implemented');
    case 'and':
    case 'or':
      throw new Error('not implemented');
    case 'not':
      throw new Error('not implemented');
    default:
      throw new Error('invalid operator');
  }
};

/**
 * Add filter condition to builder.
 *
 * @param builder - {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} instance.
 * @param indexToken - Index token in {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} `indexParamsMap`.
 * @param condition - {@link FilterCondition | `FilterCondition`} object.
 */
export const addFilterCondition = (
  builder: ShardQueryMapBuilder,
  indexToken: string,
  condition: FilterCondition,
): void => {
  try {
    // Default index map value.
    builder.indexParamsMap[indexToken] ??= {
      expressionAttributeNames: {},
      expressionAttributeValues: {},
      filterConditions: [],
    };

    // Compose condition string.
    const conditionString = composeCondition(builder, indexToken, condition);

    builder.logger.debug(
      conditionString === undefined
        ? 'no filter condition added'
        : 'added filter condition',
      {
        indexToken,
        condition,
        conditionString,
      },
    );
  } catch (error) {
    if (error instanceof Error)
      builder.logger.error(error.message, {
        indexToken,
        condition,
      });

    throw error;
  }
};
