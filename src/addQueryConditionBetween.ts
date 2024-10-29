import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import { isNil } from '@karmaniverous/entity-manager';

import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionBetween } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionBetween = <
  T extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: ShardQueryMapBuilder,
  indexToken: string,
  {
    property,
    value: { from: valueFrom, to: valueTo },
  }: QueryConditionBetween<T>,
): string | undefined => {
  if (isNil(valueFrom) && isNil(valueTo)) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const aliasFrom = attributeValueAlias();
  const aliasTo = attributeValueAlias();

  if (!isNil(valueFrom))
    builder.indexParamsMap[indexToken].expressionAttributeValues[aliasFrom] =
      valueFrom.toString();

  if (!isNil(valueTo))
    builder.indexParamsMap[indexToken].expressionAttributeValues[aliasTo] =
      valueTo.toString();

  return !isNil(valueFrom) && !isNil(valueTo)
    ? `#${property} BETWEEN ${aliasFrom} AND ${aliasTo}`
    : !isNil(valueFrom) && isNil(valueTo)
      ? `#${property} >= ${aliasFrom}`
      : `#${property} <= ${aliasTo}`;
};
