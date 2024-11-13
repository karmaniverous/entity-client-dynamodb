import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { WaiterConfiguration } from '@smithy/types';

/**
 * {@link WaiterConfiguration | `WaiterConfiguration`} with `client` parameter omitted.
 *
 * @category EntityClient
 * @protected
 */
export type WaiterConfig = Omit<WaiterConfiguration<DynamoDBClient>, 'client'>;
