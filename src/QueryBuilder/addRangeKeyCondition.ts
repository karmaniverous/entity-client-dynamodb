import type {
  BaseConfigMap,
  BaseEntityClient,
  BaseQueryBuilder,
  EntityToken,
} from '@karmaniverous/entity-manager';

import { addQueryConditionBeginsWith } from './addQueryConditionBeginsWith';
import { addQueryConditionBetween } from './addQueryConditionBetween';
import { addQueryConditionComparison } from './addQueryConditionComparison';
import type { IndexParams } from './IndexParams';
import { QueryBuilder } from './QueryBuilder';
import type {
  ComposeCondition,
  QueryConditionBeginsWith,
  QueryConditionBetween,
  QueryConditionComparison,
} from './QueryCondition';

/**
 * Passed as `condition` argument to {@link QueryBuilder.addRangeKeyCondition | `QueryBuilder.addRangeKeyCondition`}.
 *
 * @remarks
 * The `operator` property determines the condition type. Operators map to conditions as follows:
 * - `begins_with` - {@link QueryConditionBeginsWith | `QueryConditionBeginsWith`}
 * - `between` - {@link QueryConditionBetween | `QueryConditionBetween`}
 * - `<`, `<=`, `=`, `>`, `>=`, `<>` - {@link QueryConditionComparison | `QueryConditionComparison`}
 *
 * For more info, see the DynamoDB [key condition expression documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
 *
 * @category QueryBuilder
 * @protected
 */
export type RangeKeyCondition =
  | QueryConditionBeginsWith
  | QueryConditionBetween<string | number>
  | QueryConditionComparison<string | number>;

/**
 * Add range key condition to builder.
 *
 * @param builder - {@link QueryBuilder | `QueryBuilder`} instance.
 * @param indexToken - Index token in {@link QueryBuilder | `QueryBuilder`} `indexParamsMap`.
 * @param condition - {@link RangeKeyCondition | `RangeKeyCondition`} object.
 */
export const addRangeKeyCondition = <
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
  condition: RangeKeyCondition,
): void => {
  /**
   * Recursively compose condition string and add expression attribute names & values to builder.
   *
   * @param builder - {@link QueryBuilder | `QueryBuilder`} instance.
   * @param indexToken - Index token in {@link QueryBuilder | `QueryBuilder`} `indexParamsMap`.
   * @param condition - {@link RangeKeyCondition | `RangeKeyCondition`} object.
   *
   * @returns - Condition string or `undefined`.
   */
  const composeCondition: ComposeCondition<C, RangeKeyCondition> = (
    b,
    idx,
    cond,
  ): string | undefined => {
    // Internal helpers accept QueryBuilder<C>; cast locally to satisfy their parameter types.
    const qb = b as unknown as QueryBuilder<C>;
    const token = idx as unknown as string;
    const c = cond;

    switch (c.operator) {
      case 'begins_with':
        return addQueryConditionBeginsWith(qb, token, c);
      case 'between':
        return addQueryConditionBetween(qb, token, c);
      case '<':
      case '<=':
      case '=':
      case '>':
      case '>=':
      case '<>':
        return addQueryConditionComparison(qb, token, c);
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

    // No replacement of existing range key condition.
    if (builder.indexParamsMap[indexToken].rangeKeyCondition !== undefined)
      throw new Error('range key condition already exists');

    // Compose condition string.
    const conditionString = composeCondition(
      builder as unknown as QueryBuilder<C>,
      indexToken as unknown as string,
      condition,
    );

    builder.entityClient.logger.debug(
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
      builder.entityClient.logger.error(error.message, {
        indexToken,
        condition,
      });

    throw error;
  }
};
