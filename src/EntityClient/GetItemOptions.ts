import type { GetCommandInput } from '@aws-sdk/lib-dynamodb';

/**
 * Options for EntityClient.getItem.
 * - removeKeys: when true and a token-aware overload is used, generated/global keys are removed from the returned Item.
 *   Without a token, removeKeys is ignored (no runtime error).
 */
export interface GetItemOptions
  extends Omit<
    GetCommandInput,
    | 'Key'
    | 'AttributesToGet'
    | 'ExpressionAttributeNames'
    | 'ProjectionExpression'
    | 'TableName'
  > {
  removeKeys?: boolean;
}
