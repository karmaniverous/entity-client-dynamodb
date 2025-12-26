import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type {
  BaseConfigMap,
  EntityToken,
  PageKeyByIndex,
} from '@karmaniverous/entity-manager';
import { shake, sift } from 'radash';

import type { IndexParams } from '../QueryBuilder';

/**
 * Parameters for {@link getDocumentQueryArgs | `getDocumentQueryArgs`}.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam ET - Entity token for the query.
 * @typeParam IT - Index token type.
 * @typeParam CF - Values-first config literal type carried by {@link EntityClient | `EntityClient`}.
 *
 * @category EntityClient
 */
export interface GetDocumentQueryArgsParams<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  IT extends string,
  CF = unknown,
> {
  /** Per-index builder params (expression names/values, conditions, projections). */
  indexParamsMap: Record<IT, IndexParams>;
  /** Index token to build the query args for. */
  indexToken: IT;
  /** Hash key token used in the key condition expression. */
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  /** Fully-formed hash key value (including any shard suffix), bound as `:hashKey`. */
  hashKey: string;
  /** Optional paging key for this index. */
  pageKey?: PageKeyByIndex<C, ET, IT, CF> | undefined;
  /** Optional per-shard page size. */
  pageSize?: number | undefined;
  /** Table name to query. */
  tableName: string;
}

/**
 * Build DynamoDB DocumentClient query arguments from {@link IndexParams | `IndexParams`} for a specific index token.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam ET - Entity token for the query.
 * @typeParam IT - Index token type.
 * @typeParam CF - Values-first config literal type carried by {@link EntityClient | `EntityClient`}.
 *
 * @param params - Arguments describing the index, keys, and current builder state.
 * @returns A {@link QueryCommandInput | `QueryCommandInput`} suitable for `DynamoDBDocument.query(...)`.
 *
 * @category EntityClient
 */
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
