import type {
  BaseQueryBuilderOptions,
  EntityMap,
} from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import { EntityClient } from './EntityClient';

/**
 * {@link QueryBuilder | `QueryBuilder`} constructor options.
 *
 * @category QueryBuilder
 */
export interface QueryBuilderOptions<
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> extends BaseQueryBuilderOptions<
    EntityClient,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  > {
  /** Table name. */
  tableName: string;
}
