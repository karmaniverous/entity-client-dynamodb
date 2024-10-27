import type { Item } from './Item';

export type RangeKeyConditionOperator =
  | '<'
  | '<='
  | '='
  | '>'
  | '>='
  | 'begins_with'
  | 'between';

export interface AddRangeKeyConditionParams {
  indexToken: string;
  item: Item;
  rangeKeyToken: string;
  operator: RangeKeyConditionOperator;
  toItem?: Item;
}
