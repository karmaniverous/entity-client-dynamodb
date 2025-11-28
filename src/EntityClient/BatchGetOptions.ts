import { BatchGetCommandInput } from '@aws-sdk/lib-dynamodb';
import { BatchProcessOptions } from '@karmaniverous/batch-process';

/**
 * Options for batch get operations.
 *
 * @category EntityClient
 * @protected
 */
export interface BatchGetOptions extends Omit<
  BatchGetCommandInput,
  'RequestItems'
> {
  batchProcessOptions?: Omit<
    BatchProcessOptions<unknown, unknown>,
    'batchHandler' | 'unprocessedItemExtractor'
  >;
  tableName?: string;
}
