import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import {
  type Exactify,
  isNil,
  type TranscodeMap,
} from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionComparison } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionComparison = <
  V extends Exclude<NativeScalarAttributeValue, object>,
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: ShardQueryMapBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
  indexToken: string,
  { operator, property, value }: QueryConditionComparison<V>,
): string | undefined => {
  if (isNil(value)) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const alias = attributeValueAlias();

  builder.indexParamsMap[indexToken].expressionAttributeValues[alias] =
    value.toString();

  return `#${property} ${operator} ${alias}`;
};
