import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionBeginsWith } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionBeginsWith = (
  builder: ShardQueryMapBuilder,
  indexToken: string,
  { operator, property, value }: QueryConditionBeginsWith,
): string | undefined => {
  if (!value) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const alias = attributeValueAlias();

  builder.indexParamsMap[indexToken].expressionAttributeValues[alias] = value;

  return `${operator}(#${property}, ${alias})`;
};
