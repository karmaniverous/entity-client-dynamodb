import type { Entity } from '@karmaniverous/entity-tools';

import type { QueryConditionExists } from './QueryCondition';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

export const addQueryConditionExists = <Item extends Entity>(
  builder: ShardQueryMapBuilder<Item>,
  indexToken: string,
  { operator, property }: QueryConditionExists,
): string | undefined => {
  builder.indexParamsMap[indexToken].expressionAttributeNames[`#${property}`] =
    property;

  return `${operator}(#${property})`;
};
