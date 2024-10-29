import type { QueryConditionExists } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionExists = (
  builder: ShardQueryMapBuilder,
  indexToken: string,
  { operator, property }: QueryConditionExists,
): string | undefined => {
  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  return `${operator}(#${property})`;
};
