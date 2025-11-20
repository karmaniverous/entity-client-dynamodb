import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

import { attributeValueAlias } from './attributeValueAlias';
import type { MinimalBuilder, QueryConditionContains } from './QueryCondition';

export const addQueryConditionContains = <
  V extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: MinimalBuilder,
  indexToken: string,
  { operator, property, value }: QueryConditionContains<V>,
): string | undefined => {
  if (value === undefined) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const alias = attributeValueAlias();

  builder.indexParamsMap[indexToken].expressionAttributeValues[alias] = value;

  return `${operator}(#${property}, ${alias})`;
};
