import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionContains } from './QueryCondition';

export const addQueryConditionContains = <
  V extends NativeScalarAttributeValue,
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: QueryBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
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
