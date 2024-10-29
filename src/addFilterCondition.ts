import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

import { addQueryConditionBeginsWith } from './addQueryConditionBeginsWith';
import { addQueryConditionBetween } from './addQueryConditionBetween';
import { addQueryConditionComparison } from './addQueryConditionComparison';
import { addQueryConditionContains } from './addQueryConditionContains';
import { addQueryConditionExists } from './addQueryConditionExists';
import { addQueryConditionGroup } from './addQueryConditionGroup';
import { addQueryConditionIn } from './addQueryConditionIn';
import { addQueryConditionNot } from './addQueryConditionNot';
import type {
  ActuallyScalarAttributeValue,
  ComposeCondition,
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
  | QueryConditionBetween<ActuallyScalarAttributeValue>
  | QueryConditionComparison<ActuallyScalarAttributeValue>
  | QueryConditionContains<NativeScalarAttributeValue>
  | QueryConditionExists
  | QueryConditionIn<ActuallyScalarAttributeValue>
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
const composeCondition: ComposeCondition<FilterCondition> = (
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
    case 'contains':
      return addQueryConditionContains(builder, indexToken, condition);
    case 'attribute_exists':
    case 'attribute_not_exists':
      return addQueryConditionExists(builder, indexToken, condition);
    case 'in':
      return addQueryConditionIn(builder, indexToken, condition);
    case 'and':
    case 'or':
      return addQueryConditionGroup(
        builder,
        indexToken,
        condition,
        composeCondition,
      );
    case 'not':
      return addQueryConditionNot(
        builder,
        indexToken,
        condition,
        composeCondition,
      );
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
