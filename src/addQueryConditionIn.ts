import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { Entity } from '@karmaniverous/entity-tools';

import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionIn } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionIn = <
  T extends Exclude<NativeScalarAttributeValue, object>,
  Item extends Entity,
>(
  builder: ShardQueryMapBuilder<Item>,
  indexToken: string,
  { operator, property, value }: QueryConditionIn<T>,
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
