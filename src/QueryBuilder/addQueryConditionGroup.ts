import { sift } from 'radash';

import type {
  ComposeCondition,
  MinimalBuilder,
  QueryCondition,
  QueryConditionGroup,
} from './QueryCondition';

export const addQueryConditionGroup = <Q extends QueryCondition>(
  builder: MinimalBuilder,
  indexToken: string,
  { operator, conditions }: QueryConditionGroup<Q>,
  composeCondition: ComposeCondition<MinimalBuilder, Q>,
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
