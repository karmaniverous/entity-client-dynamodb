import { BatchWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { BatchProcessOptions } from '@karmaniverous/batch-process';

/**
 * Options for batch put & delete operations.
 *
 * @category EntityClient
 * @protected
 */
export interface BatchWriteOptions
  extends Omit<BatchWriteCommandInput, 'RequestItems'> {
  batchProcessOptions?: Omit<
    BatchProcessOptions<unknown, unknown>,
    'batchHandler' | 'unprocessedItemExtractor'
  >;
  tableName?: string;
}
