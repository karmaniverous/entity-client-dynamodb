import {
  CreateTableCommand,
  type CreateTableCommandInput,
  type CreateTableCommandOutput,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import type { MakeOptional } from '@karmaniverous/entity-tools';

import type { EntityClient } from '../EntityClient';
import type { WaiterConfig } from '../WaiterConfig';

/**
 * Result returned by {@link EntityClient.createTable | `EntityClient.createTable`}.
 *
 * @category EntityClient
 */
export interface CreateTableResult {
  /** Raw AWS SDK {@link CreateTableCommandOutput | `CreateTableCommandOutput`} response. */
  createTableCommandOutput: CreateTableCommandOutput;
  /** Waiter result from {@link waitUntilTableExists | `waitUntilTableExists`}. */
  waiterResult: Awaited<ReturnType<typeof waitUntilTableExists>>;
}

/**
 * Helper implementation for EntityClient.createTable.
 */
export async function createTable<C extends BaseConfigMap>(
  client: EntityClient<C>,
  options: MakeOptional<CreateTableCommandInput, 'TableName'>,
  waiterConfig: WaiterConfig = { maxWaitTime: 60 },
): Promise<CreateTableResult> {
  try {
    // Resolve options.
    const resolvedOptions: CreateTableCommandInput = {
      TableName: client.tableName,
      ...options,
    };

    // Send command.
    const createTableCommandOutput = await client.client.send(
      new CreateTableCommand(resolvedOptions),
    );

    if (!createTableCommandOutput.TableDescription?.TableStatus) {
      const msg = 'table creation request failed';
      client.logger.error(msg, createTableCommandOutput);
      throw new Error(msg);
    }

    // Await table creation.
    const waiterResult = await waitUntilTableExists(
      { client: client.client, ...waiterConfig },
      { TableName: resolvedOptions.TableName },
    );

    client.logger.debug('created table', {
      options,
      resolvedOptions,
      createTableCommandOutput,
      waiterResult,
    });

    return { createTableCommandOutput, waiterResult };
  } catch (error) {
    if (error instanceof Error) client.logger.error(error.message, { options });
    throw error;
  }
}
