import { BatchWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { BatchProcessOptions } from '@karmaniverous/batch-process';

/**
 * Options for batch put & delete operations.
 *
 * @category EntityClient
 */
export interface BatchWriteOptions extends Omit<
  BatchWriteCommandInput,
  'RequestItems'
> {
  /** Optional {@link BatchProcessOptions | `BatchProcessOptions`} override passed to the internal batching loop. */
  batchProcessOptions?: Omit<
    BatchProcessOptions<unknown, unknown>,
    'batchHandler' | 'unprocessedItemExtractor'
  >;
  /** Optional table name override (defaults to {@link EntityClient.tableName | `EntityClient.tableName`}). */
  tableName?: string | undefined;
}
