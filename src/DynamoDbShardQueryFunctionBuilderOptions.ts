import type {
  EntityMap,
  Exactify,
  ItemMap,
  ShardQueryFunctionBuilderOptions,
  TranscodeMap,
} from '@karmaniverous/entity-manager';

import { DynamoDbEntityManagerClient } from './DynamoDbEntityManagerClient';

export interface DynamoDbShardQueryFunctionBuilderOptions<
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> extends ShardQueryFunctionBuilderOptions<
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
