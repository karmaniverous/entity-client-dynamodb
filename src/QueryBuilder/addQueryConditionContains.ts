import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';

import { attributeValueAlias } from './attributeValueAlias';
import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionContains } from './QueryCondition';

export const addQueryConditionContains = <
  C extends BaseConfigMap,
  V extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: QueryBuilder<C>,
  indexToken: string,
  { operator, property, value }: QueryConditionContains<V>,
): string | undefined => {
  if (value === undefined) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const alias = attributeValueAlias();

  builder.indexParamsMap[indexToken].expressionAttributeValues[alias] =
    value?.toString();

  return `${operator}(#${property}, ${alias})`;
};
