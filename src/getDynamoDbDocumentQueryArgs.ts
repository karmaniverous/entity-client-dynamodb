import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type {
  EntityMap,
  Exactify,
  ItemMap,
  PartialTranscodable,
  TranscodeMap,
} from '@karmaniverous/entity-manager';
import { shake, sift } from 'radash';

import { DynamoDbShardQueryMapBuilder } from './DynamoDbShardQueryMapBuilder';

export const getDynamoDbDocumentQueryArgs = <
  Item extends ItemMap<M, HashKey, RangeKey>[EntityToken],
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  dynamoDbShardQueryMapBuilder: DynamoDbShardQueryMapBuilder<
    Item,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  >,
  indexToken: string,
  hashKey: string,
  pageKey?: PartialTranscodable<Item, T>,
  pageSize?: number,
): QueryCommandInput => {
  const {
    expressionAttributeNames,
    expressionAttributeValues,
    filterConditions,
    rangeKeyCondition,
  } = dynamoDbShardQueryMapBuilder.indexMap[indexToken];

  const siftedFilterConditions = sift(filterConditions);

  return {
    ExclusiveStartKey: pageKey,
    ExpressionAttributeNames: {
      [`#${dynamoDbShardQueryMapBuilder.options.hashKeyToken}`]: `:${dynamoDbShardQueryMapBuilder.options.hashKeyToken}`,
      ...shake(expressionAttributeNames),
    },
    ExpressionAttributeValues: {
      [`#${dynamoDbShardQueryMapBuilder.options.hashKeyToken}`]: hashKey,
      ...shake(expressionAttributeValues),
    },
    ...(siftedFilterConditions.length
      ? { FilterExpression: siftedFilterConditions.join(' AND ') }
      : {}),
    IndexName: indexToken,
    KeyConditionExpression: [
      `#${dynamoDbShardQueryMapBuilder.options.hashKeyToken} = :${dynamoDbShardQueryMapBuilder.options.hashKeyToken}`,
      ...(rangeKeyCondition ? [rangeKeyCondition] : []),
    ].join(' AND '),
    ...(pageSize ? { Limit: pageSize } : {}),
    ScanIndexForward: dynamoDbShardQueryMapBuilder.options.scanIndexForward,
    TableName: dynamoDbShardQueryMapBuilder.options.tableName,
  };
};
