import type {
  EntityMap,
  Exactify,
  ItemMap,
  ShardQueryMapBuilderOptions,
  TranscodeMap,
} from '@karmaniverous/entity-manager';

import { DynamoDbEntityManagerClient } from './DynamoDbEntityManagerClient';

export interface DynamoDbShardQueryMapBuilderOptions<
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> extends ShardQueryMapBuilderOptions<
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  > {
  dynamoDbEntityManagerClient: DynamoDbEntityManagerClient;
  scanIndexForward?: boolean;
  tableName: string;
}
