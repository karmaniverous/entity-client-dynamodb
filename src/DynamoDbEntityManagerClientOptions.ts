import type { BatchProcessOptions } from '@karmaniverous/batch-process';

/**
 * Entity Manager DynamoDB client options.
 */
export interface DynamoDbEntityManagerClientOptions {
  /** Default batch process options. */
  batchProcessOptions?: Omit<
    BatchProcessOptions<unknown, unknown>,
    'batchHandler' | 'unprocessedItemExtractor'
  >;

  /** Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment. */
  enableXray?: boolean;

  /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
  logger?: Pick<Console, 'debug' | 'error'>;
}
