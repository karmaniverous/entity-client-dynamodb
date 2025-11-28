/**
 * Delete and purge helpers (thin wrappers) for get-dotenv plugin services.
 *
 * Requirements addressed:
 * - delete-table: TableName from flags/config/env; waiter supported.
 * - purge-table: TableName from flags/config/env.
 * - These wrappers remain pure; CLI-level confirm/logging is out of scope here.
 */

import type { BaseConfigMap } from '@karmaniverous/entity-manager';

import type { BatchWriteOptions } from '../../EntityClient/BatchWriteOptions';
import type { EntityClient } from '../../EntityClient/EntityClient';
import type { WaiterConfig } from '../../EntityClient/WaiterConfig';

export interface DeleteTableOptions {
  /** Optional waiter configuration (maxWaitTime, etc.). */
  waiter?: WaiterConfig;
  /** One-off TableName override (does not mutate client.tableName). */
  tableNameOverride?: string;
}

/**
 * Delete a DynamoDB table using EntityClient, with an optional TableName override and waiter.
 */
export async function deleteTable<C extends BaseConfigMap>(
  client: EntityClient<C>,
  options?: DeleteTableOptions,
) {
  const tableInput = options?.tableNameOverride
    ? { TableName: options.tableNameOverride }
    : {};
  return client.deleteTable(tableInput as never, options?.waiter);
}

export interface PurgeTableOptions extends Omit<
  BatchWriteOptions,
  'tableName'
> {
  /**
   * One-off TableName override for purging; supersedes options.tableName.
   * Provided as a distinct option to keep call sites explicit.
   */
  tableNameOverride?: string;
}

/**
 * Purge all items from a table using EntityClient, with an optional TableName override.
 *
 * @returns Number of items purged.
 */
export async function purgeTable<C extends BaseConfigMap>(
  client: EntityClient<C>,
  options?: PurgeTableOptions,
): Promise<number> {
  const { tableNameOverride, ...rest } = options ?? {};
  const batchOpts: BatchWriteOptions = {
    ...(rest as BatchWriteOptions),
    ...(tableNameOverride ? { tableName: tableNameOverride } : {}),
  };
  return client.purgeItems(batchOpts);
}
