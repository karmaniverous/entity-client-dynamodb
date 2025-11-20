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
import type {
  ActuallyScalarAttributeValue,
  ComposeCondition,
  MinimalBuilder,
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
 * @param builder - BaseQueryBuilder-like instance (variance-friendly).
 * @param indexToken - Index token in `indexParamsMap`.
 * @param condition - `FilterCondition` object.
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
   * @param b - Builder instance.
   * @param idx - Index token in builder `indexParamsMap`.
   * @param cond - FilterCondition object.
   *
   * @returns - Condition string or `undefined`.
   */
  const composeCondition: ComposeCondition<
    MinimalBuilder,
    FilterCondition<C>
  > = (b, idx, cond): string | undefined => {
    // Narrow the discriminated union on the local parameter.
    switch (cond.operator) {
      case 'begins_with':
        return addQueryConditionBeginsWith(b, idx, cond);
      case 'between':
        return addQueryConditionBetween(b, idx, cond);
      case '<':
      case '<=':
      case '=':
      case '>':
      case '>=':
      case '<>':
        return addQueryConditionComparison(b, idx, cond);
      case 'contains':
        return addQueryConditionContains(b, idx, cond);
      case 'attribute_exists':
      case 'attribute_not_exists':
        return addQueryConditionExists(b, idx, cond);
      case 'in':
        return addQueryConditionIn(b, idx, cond);
      case 'and':
      case 'or':
        return addQueryConditionGroup(b, idx, cond, composeCondition);
      case 'not':
        return addQueryConditionNot(b, idx, cond, composeCondition);
      default:
        throw new Error('invalid operator');
    }
  };

  try {
    // Default index map value.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    builder.indexParamsMap[indexToken] ??= {
      expressionAttributeNames: {},
      expressionAttributeValues: {},
      filterConditions: [],
    };

    // Compose condition string.
    const conditionString = composeCondition(
      builder as never,
      indexToken,
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
