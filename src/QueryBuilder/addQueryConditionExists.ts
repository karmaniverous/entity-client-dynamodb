import type { MinimalBuilder, QueryConditionExists } from './QueryCondition';

export const addQueryConditionExists = (
  builder: MinimalBuilder,
  indexToken: string,
  { operator, property }: QueryConditionExists,
): string | undefined => {
  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  return `${operator}(#${property})`;
};
