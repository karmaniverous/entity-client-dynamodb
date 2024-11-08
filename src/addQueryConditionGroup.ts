import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';
import { sift } from 'radash';

import { QueryBuilder } from './QueryBuilder';
import type {
  ComposeCondition,
  QueryCondition,
  QueryConditionGroup,
} from './QueryCondition';

export const addQueryConditionGroup = <
  C extends QueryCondition,
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  builder: QueryBuilder<Item, EntityToken, M, HashKey, RangeKey, T>,
  indexToken: string,
  { operator, conditions }: QueryConditionGroup<C>,
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
  const conditionStrings = sift(
    conditions.map((condition) =>
      composeCondition(builder, indexToken, condition),
    ),
  );

  if (conditionStrings.length)
    return conditionStrings
      .map((conditionString) => `(${conditionString})`)
      .join(` ${operator.toUpperCase()} `);
};
