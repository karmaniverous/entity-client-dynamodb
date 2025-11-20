import { attributeValueAlias } from './attributeValueAlias';
import type {
  MinimalBuilder,
  QueryConditionBeginsWith,
} from './QueryCondition';

export const addQueryConditionBeginsWith = (
  builder: MinimalBuilder,
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
