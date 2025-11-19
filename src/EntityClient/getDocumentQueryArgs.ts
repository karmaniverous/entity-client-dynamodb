import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityToken,
  PageKeyByIndex,
} from '@karmaniverous/entity-manager';
import { shake, sift } from 'radash';

import type { IndexParams } from '../QueryBuilder';

export interface GetDocumentQueryArgsParams<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  IT extends string,
  CF = unknown,
> {
  indexParamsMap: Record<IT, IndexParams>;
  indexToken: IT;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  hashKey: string;
  pageKey?: PageKeyByIndex<C, ET, IT, CF>;
  pageSize?: number;
  tableName: string;
}

export const getDocumentQueryArgs = <
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  IT extends string,
  CF = unknown,
>({
  indexParamsMap,
  indexToken,
  hashKeyToken,
  hashKey,
  pageKey,
  pageSize,
  tableName,
}: GetDocumentQueryArgsParams<C, ET, IT, CF>): QueryCommandInput => {
  const {
    expressionAttributeNames,
    expressionAttributeValues,
    filterConditions,
    rangeKeyCondition,
    scanIndexForward,
    projectionAttributes,
  } = indexParamsMap[indexToken];

  const siftedFilterConditions = sift(filterConditions);

  // Build projection expression components (optional).
  const projectionNameMap: Record<string, string> = {};
  const projectionExpression = projectionAttributes?.length
    ? Array.from(new Set(projectionAttributes))
        .map((a) => {
          projectionNameMap[`#${a}`] = a;
          return `#${a}`;
        })
        .join(',')
    : undefined;

  return {
    ...(pageKey === undefined ? {} : { ExclusiveStartKey: pageKey }),
    ExpressionAttributeNames: {
      [`#${hashKeyToken}`]: hashKeyToken,
      ...shake(expressionAttributeNames),
      ...(projectionExpression ? projectionNameMap : {}),
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
    ...(projectionExpression
      ? { ProjectionExpression: projectionExpression }
      : {}),
    ...(pageSize ? { Limit: pageSize } : {}),
    ...(scanIndexForward === undefined
      ? {}
      : { ScanIndexForward: scanIndexForward }),
    TableName: tableName,
  };
};
