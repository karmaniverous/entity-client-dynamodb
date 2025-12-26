import type { NativeScalarAttributeValue } from '@aws-sdk/lib-dynamodb';

/**
 * IndexParams
 *
 * @category QueryBuilder
 */
export interface IndexParams {
  /** Expression attribute names for this index (e.g., `#created` -\> `created`). */
  expressionAttributeNames: Record<string, string | undefined>;
  /** Expression attribute values for this index (e.g., `:v123` -\> `1700000000`). */
  expressionAttributeValues: Record<
    string,
    NativeScalarAttributeValue | undefined
  >;
  /** Filter expressions to AND together (already rendered with aliases). */
  filterConditions: (string | undefined)[];
  /** Optional list of attributes to project for this index. */
  projectionAttributes?: string[] | undefined;
  /** Optional key condition expression for the range key. */
  rangeKeyCondition?: string | undefined;
  /** Optional scan direction override for the index. */
  scanIndexForward?: boolean | undefined;
}
