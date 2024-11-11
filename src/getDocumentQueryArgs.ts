import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { BaseConfigMap, PageKey } from '@karmaniverous/entity-manager';
import { shake, sift } from 'radash';

import type { IndexParams } from './IndexParams';

export interface GetDocumentQueryArgsParams<C extends BaseConfigMap> {
  indexParamsMap: Record<string, IndexParams>;
  indexToken: string;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  hashKey: string;
  pageKey?: PageKey<C>;
  pageSize?: number;
  tableName: string;
}

export const getDocumentQueryArgs = <C extends BaseConfigMap>({
  indexParamsMap,
  indexToken,
  hashKeyToken,
  hashKey,
  pageKey,
  pageSize,
  tableName,
}: GetDocumentQueryArgsParams<C>): QueryCommandInput => {
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
