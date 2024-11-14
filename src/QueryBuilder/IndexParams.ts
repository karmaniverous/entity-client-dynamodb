/**
 * IndexParams
 *
 * @category QueryBuilder
 * @protected
 */
export interface IndexParams {
  expressionAttributeNames: Record<string, string | undefined>;
  expressionAttributeValues: Record<string, string | undefined>;
  filterConditions: (string | undefined)[];
  rangeKeyCondition?: string;
  scanIndexForward?: boolean;
}
