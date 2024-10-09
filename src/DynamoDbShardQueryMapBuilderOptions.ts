import type { ShardQueryMapBuilderOptions } from '@karmaniverous/entity-manager';

import { DynamoDbEntityManagerClient } from './DynamoDbEntityManagerClient';

export interface DynamoDbShardQueryMapBuilderOptions
  extends ShardQueryMapBuilderOptions {
  dynamoDbEntityManagerClient: DynamoDbEntityManagerClient;
  scanIndexForward?: boolean;
  tableName: string;
}
