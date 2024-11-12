import { waitUntilTableExists } from '@aws-sdk/client-dynamodb';

/* eslint-disable tsdoc/syntax */
/**
 * {@link smithy!waiter | `WaiterConfiguration`} with `client` parameter omitted.
 *
 * @category EntityClient
 * @protected
 */
export type WaiterConfig = Omit<
  Parameters<typeof waitUntilTableExists>[0],
  'client'
>;
/* eslint-enable tsdoc/syntax */
