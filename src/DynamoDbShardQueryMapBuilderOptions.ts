import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import type { ShardQueryMapBuilderOptions } from '@karmaniverous/entity-manager';

export interface DynamoDbShardQueryMapBuilderOptions
  extends ShardQueryMapBuilderOptions {
  dynamoDBDocument: DynamoDBDocument;

  /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
  logger: Pick<Console, 'debug' | 'error'>;

  scanIndexForward?: boolean;

  tableName: string;
}
