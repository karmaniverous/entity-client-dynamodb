import {
  DeleteTableCommand,
  type DeleteTableCommandInput,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import type { MakeOptional } from '@karmaniverous/entity-tools';

import type { EntityClient } from '../EntityClient';
import type { WaiterConfig } from '../WaiterConfig';

/**
 * Helper implementation for EntityClient.deleteTable.
 */
export async function deleteTable<C extends BaseConfigMap>(
  this: EntityClient<C>,
  options: MakeOptional<DeleteTableCommandInput, 'TableName'> = {},
  waiterConfig: WaiterConfig = { maxWaitTime: 60 },
) {
  try {
    // Resolve options.
    const resolvedOptions: DeleteTableCommandInput = {
      TableName: this.tableName,
      ...options,
    };

    // Send command.
    const deleteTableCommandOutput = await this.client.send(
      new DeleteTableCommand(resolvedOptions),
    );

    if (!deleteTableCommandOutput.TableDescription?.TableStatus) {
      const msg = 'table deletion request failed';
      this.logger.error(msg, deleteTableCommandOutput);
      throw new Error(msg);
    }

    // Await table deletion.
    const waiterResult = await waitUntilTableNotExists(
      { client: this.client, ...waiterConfig },
      { TableName: resolvedOptions.TableName },
    );

    this.logger.debug('deleted table', {
      options,
      resolvedOptions,
      deleteTableCommandOutput,
      waiterResult,
    });

    return { deleteTableCommandOutput, waiterResult };
  } catch (error) {
    if (error instanceof Error) this.logger.error(error.message, { options });
    throw error;
  }
}
