import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionNot,
} from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionNot = <
  C extends QueryCondition,
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: ShardQueryMapBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
  indexToken: string,
  { operator, condition }: QueryConditionNot<C>,
  composeCondition: ComposeCondition<
    C,
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  >,
): string | undefined => {
  const conditionString = composeCondition(builder, indexToken, condition);

  if (conditionString) return `${operator.toUpperCase()} (${conditionString})`;
};
