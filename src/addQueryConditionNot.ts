import type { BaseConfigMap } from '@karmaniverous/entity-manager';

import { QueryBuilder } from './QueryBuilder';
import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionNot,
} from './QueryCondition';

export const addQueryConditionNot = <
  C extends BaseConfigMap,
  Q extends QueryCondition,
>(
  builder: QueryBuilder<C>,
  indexToken: string,
  { operator, condition }: QueryConditionNot<Q>,
  composeCondition: ComposeCondition<C, Q>,
): string | undefined => {
  const conditionString = composeCondition(builder, indexToken, condition);

  if (conditionString) return `${operator.toUpperCase()} (${conditionString})`;
};
