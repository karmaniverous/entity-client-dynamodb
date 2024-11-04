import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { Entity } from '@karmaniverous/entity-tools';
import { shake, sift } from 'radash';

import type { IndexParams } from './IndexParams';

export interface GetDynamoDbDocumentQueryArgsParams<Item extends Entity> {
  indexParamsMap: Record<string, IndexParams>;
  indexToken: string;
  hashKeyToken: keyof Item & string;
  hashKey: string;
  pageKey?: Partial<Item>;
  pageSize?: number;
  tableName: string;
}

export const getDocumentQueryArgs = <Item extends Entity>({
  indexParamsMap,
  indexToken,
  hashKeyToken,
  hashKey,
  pageKey,
  pageSize,
  tableName,
}: GetDynamoDbDocumentQueryArgsParams<Item>): QueryCommandInput => {
  const {
    expressionAttributeNames,
    expressionAttributeValues,
    filterConditions,
    rangeKeyCondition,
    scanIndexForward,
  } = indexParamsMap[indexToken];

  const siftedFilterConditions = sift(filterConditions);

  return {
    ...(pageKey === undefined ? {} : { ExclusiveStartKey: pageKey }),
    ExpressionAttributeNames: {
      [`#${hashKeyToken}`]: hashKeyToken,
      ...shake(expressionAttributeNames),
    },
    ExpressionAttributeValues: {
      ':hashKey': hashKey,
      ...shake(expressionAttributeValues),
    },
    ...(siftedFilterConditions.length
      ? {
          FilterExpression: siftedFilterConditions
            .map((c) => `(${c})`)
            .join(' AND '),
        }
      : {}),
    IndexName: indexToken,
    KeyConditionExpression: [
      `#${hashKeyToken} = :hashKey`,
      ...(rangeKeyCondition ? [rangeKeyCondition] : []),
    ].join(' AND '),
    ...(pageSize ? { Limit: pageSize } : {}),
    ...(scanIndexForward === undefined
      ? {}
      : { ScanIndexForward: scanIndexForward }),
    TableName: tableName,
  };
};
