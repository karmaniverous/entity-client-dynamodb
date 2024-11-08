import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import {
  type Exactify,
  isNil,
  type TranscodeMap,
} from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionBetween } from './QueryCondition';

export const addQueryConditionBetween = <
  V extends Exclude<NativeScalarAttributeValue, object>,
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: QueryBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
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
      valueFrom.toString();

  if (!isNil(valueTo))
    builder.indexParamsMap[indexToken].expressionAttributeValues[aliasTo] =
      valueTo.toString();

  return !isNil(valueFrom) && !isNil(valueTo)
    ? `#${property} ${operator.toUpperCase()} ${aliasFrom} AND ${aliasTo}`
    : !isNil(valueFrom) && isNil(valueTo)
      ? `#${property} >= ${aliasFrom}`
      : `#${property} <= ${aliasTo}`;
};
