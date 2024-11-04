import type { Entity } from '@karmaniverous/entity-tools';

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
 * Passed as `condition` argument to {@link ShardQueryMapBuilder.addRangeKeyCondition | `ShardQueryMapBuilder.addRangeKeyCondition`}.
 *
 * @remarks
 * The `operator` property determines the condition type. Operators map to conditions as follows:
 * - `begins_with` - {@link QueryConditionBeginsWith | `QueryConditionBeginsWith`}
 * - `between` - {@link QueryConditionBetween | `QueryConditionBetween`}
 * - `<`, `<=`, `=`, `>`, `>=`, `<>` - {@link QueryConditionComparison | `QueryConditionComparison`}
 *
 * For more info, see the DynamoDB [key condition expression documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
 *
 * @category ShardQueryMapBuilder
 * @protected
 */
export type RangeKeyCondition =
  | QueryConditionBeginsWith
  | QueryConditionBetween<string | number>
  | QueryConditionComparison<string | number>;

/**
 * Add range key condition to builder.
 *
 * @param builder - {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} instance.
 * @param indexToken - Index token in {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} `indexParamsMap`.
 * @param condition - {@link RangeKeyCondition | `RangeKeyCondition`} object.
 */
export const addRangeKeyCondition = <Item extends Entity>(
  builder: ShardQueryMapBuilder<Item>,
  indexToken: string,
  condition: RangeKeyCondition,
): void => {
  /**
   * Recursively compose condition string and add expression attribute names & values to builder.
   *
   * @param builder - {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} instance.
   * @param indexToken - Index token in {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} `indexParamsMap`.
   * @param condition - {@link RangeKeyCondition | `RangeKeyCondition`} object.
   *
   * @returns - Condition string or `undefined`.
   */
  const composeCondition: ComposeCondition<RangeKeyCondition, Item> = (
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
