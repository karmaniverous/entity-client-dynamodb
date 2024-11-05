import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import type { QueryConditionExists } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionExists = <
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: ShardQueryMapBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
  indexToken: string,
  { operator, property }: QueryConditionExists,
): string | undefined => {
  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  return `${operator}(#${property})`;
};
