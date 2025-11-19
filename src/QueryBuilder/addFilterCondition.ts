import type {
  BaseConfigMap,
  BaseEntityClient,
  BaseQueryBuilder,
  EntityToken,
} from '@karmaniverous/entity-manager';

import { addQueryConditionBeginsWith } from './addQueryConditionBeginsWith';
import { addQueryConditionBetween } from './addQueryConditionBetween';
import { addQueryConditionComparison } from './addQueryConditionComparison';
import { addQueryConditionContains } from './addQueryConditionContains';
import { addQueryConditionExists } from './addQueryConditionExists';
import { addQueryConditionGroup } from './addQueryConditionGroup';
import { addQueryConditionIn } from './addQueryConditionIn';
import { addQueryConditionNot } from './addQueryConditionNot';
import type { IndexParams } from './IndexParams';
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
export type FilterCondition<C extends BaseConfigMap> =
  | QueryConditionBeginsWith
  | QueryConditionBetween<ActuallyScalarAttributeValue>
  | QueryConditionComparison<ActuallyScalarAttributeValue>
  | QueryConditionContains<ActuallyScalarAttributeValue>
  | QueryConditionExists
  | QueryConditionIn<ActuallyScalarAttributeValue>
  | QueryConditionGroup<FilterCondition<C>>
  | QueryConditionNot<FilterCondition<C>>;

/**
 * Add filter condition to builder.
 *
 * @param builder - {@link QueryBuilder | `QueryBuilder`} instance.
 * @param indexToken - Index token in {@link QueryBuilder | `QueryBuilder`} `indexParamsMap`.
 * @param condition - {@link FilterCondition | `FilterCondition`} object.
 */
export const addFilterCondition = <
  C extends BaseConfigMap,
  Client extends BaseEntityClient<C>,
  ET extends EntityToken<C>,
  ITS extends string,
  CF = unknown,
  K = unknown,
>(
  builder: BaseQueryBuilder<C, Client, IndexParams, ET, ITS, CF, K> & {
    indexParamsMap: Record<ITS, IndexParams>;
    entityClient: { logger: Pick<Console, 'debug' | 'error'> };
  },
  indexToken: ITS,
  condition: FilterCondition<C>,
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
  const composeCondition: ComposeCondition<C, FilterCondition<C>> = (
    b,
    idx,
    cond,
  ): string | undefined => {
    // Note: internal helpers accept QueryBuilder<C>; cast locally to satisfy their parameter types.
    const qb = b as unknown as QueryBuilder<C>;
    const token = idx as unknown as string;
    const conditionLocal = cond;
    switch (condition.operator) {
      case 'begins_with':
        return addQueryConditionBeginsWith(qb, token, conditionLocal);
      case 'between':
        return addQueryConditionBetween(qb, token, conditionLocal);
      case '<':
      case '<=':
      case '=':
      case '>':
      case '>=':
      case '<>':
        return addQueryConditionComparison(qb, token, conditionLocal);
      case 'contains':
        return addQueryConditionContains(qb, token, conditionLocal);
      case 'attribute_exists':
      case 'attribute_not_exists':
        return addQueryConditionExists(qb, token, conditionLocal);
      case 'in':
        return addQueryConditionIn(qb, token, conditionLocal);
      case 'and':
      case 'or':
        return addQueryConditionGroup(
          qb,
          token,
          conditionLocal,
          composeCondition,
        );
      case 'not':
        return addQueryConditionNot(
          qb,
          token,
          conditionLocal,
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
    const conditionString = composeCondition(
      builder as unknown as QueryBuilder<C>,
      indexToken as unknown as string,
      condition,
    );

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
