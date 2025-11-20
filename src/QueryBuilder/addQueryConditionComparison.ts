import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import { isNil } from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import type {
  MinimalBuilder,
  QueryConditionComparison,
} from './QueryCondition';

export const addQueryConditionComparison = <
  V extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: MinimalBuilder,
  indexToken: string,
  { operator, property, value }: QueryConditionComparison<V>,
): string | undefined => {
  if (isNil(value)) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const alias = attributeValueAlias();

  builder.indexParamsMap[indexToken].expressionAttributeValues[alias] = value;

  return `#${property} ${operator} ${alias}`;
};
