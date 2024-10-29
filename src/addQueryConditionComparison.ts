import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import { isNil } from '@karmaniverous/entity-manager';

import { attributeValueAlias } from './attributeValueAlias';
import type { QueryConditionComparison } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionComparison = <
  T extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: ShardQueryMapBuilder,
  indexToken: string,
  { operator, property, value }: QueryConditionComparison<T>,
): string | undefined => {
  if (isNil(value)) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const alias = attributeValueAlias();

  builder.indexParamsMap[indexToken].expressionAttributeValues[alias] =
    value.toString();

  return `#${property} ${operator} ${alias}`;
};
