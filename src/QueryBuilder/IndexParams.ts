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
  rangeKeyCondition?: string;
  scanIndexForward?: boolean;
}
