import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionNot,
} from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionNot = <T extends QueryCondition>(
  builder: ShardQueryMapBuilder,
  indexToken: string,
  { operator, condition }: QueryConditionNot<T>,
  composeCondition: ComposeCondition<T>,
): string | undefined => {
  const conditionString = composeCondition(builder, indexToken, condition);

  if (conditionString) return `${operator.toUpperCase()} (${conditionString})`;
};
