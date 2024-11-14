import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import { sift } from 'radash';

import { QueryBuilder } from './QueryBuilder';
import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionGroup,
} from './QueryCondition';

export const addQueryConditionGroup = <
  C extends BaseConfigMap,
  Q extends QueryCondition,
>(
  builder: QueryBuilder<C>,
  indexToken: string,
  { operator, conditions }: QueryConditionGroup<Q>,
  composeCondition: ComposeCondition<C, Q>,
): string | undefined => {
  const conditionStrings = sift(
    conditions.map((condition) =>
      composeCondition(builder, indexToken, condition),
    ),
  );

  if (conditionStrings.length)
    return conditionStrings
      .map((conditionString) => `(${conditionString})`)
      .join(` ${operator.toUpperCase()} `);
};
