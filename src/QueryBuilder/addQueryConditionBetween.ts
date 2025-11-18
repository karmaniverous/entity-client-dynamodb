import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import { isNil } from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionBetween } from './QueryCondition';

export const addQueryConditionBetween = <
  C extends BaseConfigMap,
  V extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: QueryBuilder<C>,
  indexToken: string,
  {
    operator,
    property,
    value: { from: valueFrom, to: valueTo },
  }: QueryConditionBetween<V>,
): string | undefined => {
  if (isNil(valueFrom) && isNil(valueTo)) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const aliasFrom = attributeValueAlias();
  const aliasTo = attributeValueAlias();

  if (!isNil(valueFrom))
    builder.indexParamsMap[indexToken].expressionAttributeValues[aliasFrom] =
      valueFrom;

  if (!isNil(valueTo))
    builder.indexParamsMap[indexToken].expressionAttributeValues[aliasTo] =
      valueTo;

  return !isNil(valueFrom) && !isNil(valueTo)
    ? `#${property} ${operator.toUpperCase()} ${aliasFrom} AND ${aliasTo}`
    : !isNil(valueFrom) && isNil(valueTo)
      ? `#${property} >= ${aliasFrom}`
      : `#${property} <= ${aliasTo}`;
};
