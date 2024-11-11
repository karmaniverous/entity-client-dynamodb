import type { BaseConfigMap } from '@karmaniverous/entity-manager';

import { QueryBuilder } from './QueryBuilder';
import type { QueryConditionExists } from './QueryCondition';

export const addQueryConditionExists = <C extends BaseConfigMap>(
  builder: QueryBuilder<C>,
  indexToken: string,
  { operator, property }: QueryConditionExists,
): string | undefined => {
  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  return `${operator}(#${property})`;
};
