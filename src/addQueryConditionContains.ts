import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionContains } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionContains = <T extends NativeScalarAttributeValue>(
  builder: ShardQueryMapBuilder,
  indexToken: string,
  { operator, property, value }: QueryConditionContains<T>,
): string | undefined => {
  if (value === undefined) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const alias = attributeValueAlias();

  builder.indexParamsMap[indexToken].expressionAttributeValues[alias] =
    value?.toString();

  return `${operator}(#${property}, ${alias})`;
};
