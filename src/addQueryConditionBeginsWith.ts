import type { BaseConfigMap } from '@karmaniverous/entity-manager';

import { attributeValueAlias } from './attributeValueAlias';
import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionBeginsWith } from './QueryCondition';

export const addQueryConditionBeginsWith = <C extends BaseConfigMap>(
  builder: QueryBuilder<C>,
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
