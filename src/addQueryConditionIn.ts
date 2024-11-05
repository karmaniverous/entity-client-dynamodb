import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { EntityMap, ItemMap } from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionIn } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionIn = <
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
  { operator, property, value }: QueryConditionIn<V>,
): string | undefined => {
  if (value === undefined) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const aliases = [...value].map((v) => {
    if (v === undefined) return;

    const alias = attributeValueAlias();

    builder.indexParamsMap[indexToken].expressionAttributeValues[alias] =
      v?.toString() ?? 'null';

    return alias;
  });

  return `#${property} ${operator.toUpperCase()} (${aliases.join(', ')})`;
};
