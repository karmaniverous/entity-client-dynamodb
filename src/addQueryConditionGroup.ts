import type { Entity } from '@karmaniverous/entity-tools';
import { sift } from 'radash';

import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionGroup,
} from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionGroup = <
  T extends QueryCondition,
  Item extends Entity,
>(
  builder: ShardQueryMapBuilder<Item>,
  indexToken: string,
  { operator, conditions }: QueryConditionGroup<T>,
  composeCondition: ComposeCondition<T, Item>,
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
