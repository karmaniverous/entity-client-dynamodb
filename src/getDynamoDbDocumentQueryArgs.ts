import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { shake, sift } from 'radash';

import { DynamoDbShardQueryMapBuilder } from './DynamoDbShardQueryMapBuilder';
import { Item } from './Item';

export const getDynamoDbDocumentQueryArgs = (
  dynamoDbShardQueryMapBuilder: DynamoDbShardQueryMapBuilder,
  indexToken: string,
  hashKey: string,
  pageKey?: Item,
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
