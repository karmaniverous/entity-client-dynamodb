import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { shake, sift } from 'radash';

import type { IndexParams } from './IndexParams';
import type { Item } from './Item';

export interface GetDynamoDbDocumentQueryArgsParams {
  indexParamsMap: Record<string, IndexParams>;
  indexToken: string;
  hashKeyToken: string;
  hashKey: string;
  pageKey?: Item;
  pageSize?: number;
  scanIndexForward?: boolean;
  tableName: string;
}

export const getDocumentQueryArgs = ({
  indexParamsMap,
  indexToken,
  hashKeyToken,
  hashKey,
  pageKey,
  pageSize,
  tableName,
}: GetDynamoDbDocumentQueryArgsParams): QueryCommandInput => {
  const {
    expressionAttributeNames,
    expressionAttributeValues,
    filterConditions,
    rangeKeyCondition,
    scanIndexForward,
  } = indexParamsMap[indexToken];

  const siftedFilterConditions = sift(filterConditions);

  return {
    ExclusiveStartKey: pageKey,
    ExpressionAttributeNames: {
      [`#${hashKeyToken}`]: `:${hashKeyToken}`,
      ...shake(expressionAttributeNames),
    },
    ExpressionAttributeValues: {
      [`#${hashKeyToken}`]: hashKey,
      ...shake(expressionAttributeValues),
    },
    ...(siftedFilterConditions.length
      ? { FilterExpression: siftedFilterConditions.join(' AND ') }
      : {}),
    IndexName: indexToken,
    KeyConditionExpression: [
      `#${hashKeyToken} = :${hashKeyToken}`,
      ...(rangeKeyCondition ? [rangeKeyCondition] : []),
    ].join(' AND '),
    ...(pageSize ? { Limit: pageSize } : {}),
    ScanIndexForward: scanIndexForward,
    TableName: tableName,
  };
};
