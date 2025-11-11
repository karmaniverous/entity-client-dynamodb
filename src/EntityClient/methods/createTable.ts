import {
  CreateTableCommand,
  type CreateTableCommandInput,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import type { MakeOptional } from '@karmaniverous/entity-tools';

import type { EntityClient } from '../EntityClient';
import type { WaiterConfig } from '../WaiterConfig';

/**
 * Helper implementation for EntityClient.createTable.
 */
export async function createTable<C extends BaseConfigMap>(
  this: EntityClient<C>,
  options: MakeOptional<CreateTableCommandInput, 'TableName'>,
  waiterConfig: WaiterConfig = { maxWaitTime: 60 },
) {
  try {
    // Resolve options.
    const resolvedOptions: CreateTableCommandInput = {
      TableName: this.tableName,
      ...options,
    };

    // Send command.
    const createTableCommandOutput = await this.client.send(
      new CreateTableCommand(resolvedOptions),
    );

    if (!createTableCommandOutput.TableDescription?.TableStatus) {
      const msg = 'table creation request failed';
      this.logger.error(msg, createTableCommandOutput);
      throw new Error(msg);
    }

    // Await table creation.
    const waiterResult = await waitUntilTableExists(
      { client: this.client, ...waiterConfig },
      { TableName: resolvedOptions.TableName },
    );

    this.logger.debug('created table', {
      options,
      resolvedOptions,
      createTableCommandOutput,
      waiterResult,
    });

    return { createTableCommandOutput, waiterResult };
  } catch (error) {
    if (error instanceof Error) this.logger.error(error.message, { options });
    throw error;
  }
}
