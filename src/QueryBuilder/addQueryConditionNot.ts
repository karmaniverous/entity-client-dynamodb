import type {
  ComposeCondition,
  MinimalBuilder,
  QueryCondition,
  QueryConditionNot,
} from './QueryCondition';

export const addQueryConditionNot = <Q extends QueryCondition>(
  builder: MinimalBuilder,
  indexToken: string,
  { operator, condition }: QueryConditionNot<Q>,
  composeCondition: ComposeCondition<MinimalBuilder, Q>,
): string | undefined => {
  const conditionString = composeCondition(builder, indexToken, condition);

  if (conditionString) return `${operator.toUpperCase()} (${conditionString})`;
};
