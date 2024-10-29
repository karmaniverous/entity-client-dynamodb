import { addQueryConditionBeginsWith } from './addQueryConditionBeginsWith';
import { addQueryConditionBetween } from './addQueryConditionBetween';
import { addQueryConditionComparison } from './addQueryConditionComparison';
import type {
  ComposeCondition,
  QueryConditionBeginsWith,
  QueryConditionBetween,
  QueryConditionComparison,
} from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

/**
 * Union type of all possible filter conditions.
 *
 * @category ShardQueryMap Builder
 * @protected
 */
export type RangeKeyCondition =
  | QueryConditionBeginsWith
  | QueryConditionBetween<string | number>
  | QueryConditionComparison<string | number>;

/**
 * Recursively compose condition string and add expression attribute names & values to builder.
 *
 * @param builder - {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} instance.
 * @param indexToken - Index token in {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} `indexParamsMap`.
 * @param condition - {@link RangeKeyCondition | `RangeKeyCondition`} object.
 *
 * @returns - Condition string or `undefined`.
 */
const composeCondition: ComposeCondition<RangeKeyCondition> = (
  builder,
  indexToken,
  condition,
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
    default:
      throw new Error('invalid operator');
  }
};

/**
 * Add range key condition to builder.
 *
 * @param builder - {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} instance.
 * @param indexToken - Index token in {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} `indexParamsMap`.
 * @param condition - {@link RangeKeyCondition | `RangeKeyCondition`} object.
 */
export const addRangeKeyCondition = (
  builder: ShardQueryMapBuilder,
  indexToken: string,
  condition: RangeKeyCondition,
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

    // Compose condition string.
    const conditionString = composeCondition(builder, indexToken, condition);

    builder.logger.debug(
      conditionString === undefined
        ? 'no range key condition added'
        : 'added range key condition',
      {
        indexToken,
        condition,
        conditionString,
      },
    );

    // Save condition string.
    if (conditionString)
      builder.indexParamsMap[indexToken].rangeKeyCondition = conditionString;
  } catch (error) {
    if (error instanceof Error)
      builder.logger.error(error.message, {
        indexToken,
        condition,
      });

    throw error;
  }
};
