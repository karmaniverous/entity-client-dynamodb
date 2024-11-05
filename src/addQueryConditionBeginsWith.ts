import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionBeginsWith } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionBeginsWith = <
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: ShardQueryMapBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
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
