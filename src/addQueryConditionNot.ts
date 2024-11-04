import type { Entity } from '@karmaniverous/entity-tools';

import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionNot,
} from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionNot = <
  T extends QueryCondition,
  Item extends Entity,
>(
  builder: ShardQueryMapBuilder<Item>,
  indexToken: string,
  { operator, condition }: QueryConditionNot<T>,
  composeCondition: ComposeCondition<T, Item>,
): string | undefined => {
  const conditionString = composeCondition(builder, indexToken, condition);

  if (conditionString) return `${operator.toUpperCase()} (${conditionString})`;
};
