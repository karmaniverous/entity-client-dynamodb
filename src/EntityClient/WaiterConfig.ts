import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { WaiterConfiguration } from '@smithy/types';

/**
 * {@link WaiterConfiguration | `WaiterConfiguration`} with the `client` parameter omitted (the {@link EntityClient | `EntityClient`} supplies it).
 *
 * @category EntityClient
 */
export type WaiterConfig = Omit<WaiterConfiguration<DynamoDBClient>, 'client'>;
