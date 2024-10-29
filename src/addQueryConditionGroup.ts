import { sift } from 'radash';

import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionGroup,
} from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionGroup = <T extends QueryCondition>(
  builder: ShardQueryMapBuilder,
  indexToken: string,
  { operator, conditions }: QueryConditionGroup<T>,
  composeCondition: ComposeCondition<T>,
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
