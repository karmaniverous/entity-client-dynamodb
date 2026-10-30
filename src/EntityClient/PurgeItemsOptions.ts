import type { BaseConfigMap, EntityKey } from '@karmaniverous/entity-manager';

import type { BatchWriteOptions } from './BatchWriteOptions';

/**
 * Options for {@link EntityClient.purgeItems | `EntityClient.purgeItems`}.
 *
 * @typeParam C - Entity-manager config map.
 * @category EntityClient
 */
export interface PurgeItemsOptions<
  C extends BaseConfigMap,
> extends BatchWriteOptions {
  /**
   * Entity keys to keep, whatever the scan returns.
   *
   * Each entry carries the table's hash and range key attributes; attribute
   * order does not matter. Excluded items are still scanned, they are only left
   * out of the delete.
   */
  excludeKeys?: EntityKey<C>[];
}
