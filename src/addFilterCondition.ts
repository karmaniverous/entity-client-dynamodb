import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import { addQueryConditionBeginsWith } from './addQueryConditionBeginsWith';
import { addQueryConditionBetween } from './addQueryConditionBetween';
import { addQueryConditionComparison } from './addQueryConditionComparison';
import { addQueryConditionContains } from './addQueryConditionContains';
import { addQueryConditionExists } from './addQueryConditionExists';
import { addQueryConditionGroup } from './addQueryConditionGroup';
import { addQueryConditionIn } from './addQueryConditionIn';
import { addQueryConditionNot } from './addQueryConditionNot';
import { QueryBuilder } from './QueryBuilder';
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

/**
 * Passed as `condition` argument to {@link QueryBuilder.addFilterCondition | `QueryBuilder.addFilterCondition`}.
 *
 * @remarks
 * The `operator` property determines the condition type. Operators map to conditions as follows:
 * - `begins_with` - {@link QueryConditionBeginsWith | `QueryConditionBeginsWith`}
 * - `between` - {@link QueryConditionBetween | `QueryConditionBetween`}
 * - `<`, `<=`, `=`, `>`, `>=`, `<>` - {@link QueryConditionComparison | `QueryConditionComparison`}
 * - `contains` - {@link QueryConditionContains | `QueryConditionContains`}
 * - `attribute_exists`, `attribute_not_exists` - {@link QueryConditionExists | `QueryConditionExists`}
 * - `in` - {@link QueryConditionIn | `QueryConditionIn`}
 * - `and`, `or` - {@link QueryConditionGroup | `QueryConditionGroup`}
 * - `not` - {@link QueryConditionNot | `QueryConditionNot`}
 *
 * Note that the `and`, `or`, and `not` operators permit nested conditions.
 *
 * For more info, see the DynamoDB [filter expression documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.FilterExpression.html).
 *
 * @category QueryBuilder
 * @protected
 */
export type FilterCondition<
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> =
  | QueryConditionBeginsWith
  | QueryConditionBetween<ActuallyScalarAttributeValue>
  | QueryConditionComparison<ActuallyScalarAttributeValue>
  | QueryConditionContains<NativeScalarAttributeValue>
  | QueryConditionExists
  | QueryConditionIn<ActuallyScalarAttributeValue>
  | QueryConditionGroup<
      FilterCondition<Item, EntityToken, M, HashKey, RangeKey, T>
    >
  | QueryConditionNot<
      FilterCondition<Item, EntityToken, M, HashKey, RangeKey, T>
    >;

/**
 * Add filter condition to builder.
 *
 * @param builder - {@link QueryBuilder | `QueryBuilder`} instance.
 * @param indexToken - Index token in {@link QueryBuilder | `QueryBuilder`} `indexParamsMap`.
 * @param condition - {@link FilterCondition | `FilterCondition`} object.
 */
export const addFilterCondition = <
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: QueryBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
  indexToken: string,
  condition: FilterCondition<Item, EntityToken, M, HashKey, RangeKey, T>,
): void => {
  /**
   * Recursively compose condition string and add expression attribute names & values to builder.
   *
   * @param builder - {@link QueryBuilder | `QueryBuilder`} instance.
   * @param indexToken - Index token in {@link QueryBuilder | `QueryBuilder`} `indexParamsMap`.
   * @param condition - {@link FilterCondition | `FilterCondition`} object.
   *
   * @returns - Condition string or `undefined`.
   */
  const composeCondition: ComposeCondition<
    FilterCondition<Item, EntityToken, M, HashKey, RangeKey, T>,
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  > = (builder, indexToken, condition): string | undefined => {
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

  try {
    // Default index map value.
    builder.indexParamsMap[indexToken] ??= {
      expressionAttributeNames: {},
      expressionAttributeValues: {},
      filterConditions: [],
    };

    // Compose condition string.
    const conditionString = composeCondition(builder, indexToken, condition);

    builder.entityClient.logger.debug(
      conditionString === undefined
        ? 'no filter condition added'
        : 'added filter condition',
      {
        indexToken,
        condition,
        conditionString,
      },
    );

    // Save condition string.
    if (conditionString)
      builder.indexParamsMap[indexToken].filterConditions.push(conditionString);
  } catch (error) {
    if (error instanceof Error)
      builder.entityClient.logger.error(error.message, {
        indexToken,
        condition,
      });

    throw error;
  }
};
