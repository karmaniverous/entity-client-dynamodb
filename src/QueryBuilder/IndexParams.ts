import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

/**
 * IndexParams
 *
 * @category QueryBuilder
 * @protected
 */
export interface IndexParams {
  expressionAttributeNames: Record<string, string | undefined>;
  expressionAttributeValues: Record<
    string,
    NativeScalarAttributeValue | undefined
  >;
  filterConditions: (string | undefined)[];
  /** Optional list of attributes to project for this index. */
  projectionAttributes?: string[];
  rangeKeyCondition?: string;
  scanIndexForward?: boolean;
}
