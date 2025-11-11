import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';

import { attributeValueAlias } from './attributeValueAlias';
import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionIn } from './QueryCondition';

export const addQueryConditionIn = <
  C extends BaseConfigMap,
  V extends Exclude<NativeScalarAttributeValue, object>,
>(
  builder: QueryBuilder<C>,
  indexToken: string,
  { operator, property, value }: QueryConditionIn<V>,
): string | undefined => {
  if (value === undefined) return;

  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  const values = Array.isArray(value) ? value : Array.from(value);

  const aliases = values
    .filter((v): v is Exclude<V, undefined> => v !== undefined)
    .map((v) => {
      const alias = attributeValueAlias();

      builder.indexParamsMap[indexToken].expressionAttributeValues[alias] = v;

      return alias;
    });

  if (!aliases.length) return;

  return `#${property} ${operator.toUpperCase()} (${aliases.join(', ')})`;
};
