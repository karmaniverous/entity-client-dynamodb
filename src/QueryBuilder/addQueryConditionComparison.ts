import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import { isNil } from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionComparison } from './QueryCondition';

export const addQueryConditionComparison = <
  C extends BaseConfigMap,
  V extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: QueryBuilder<C>,
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
