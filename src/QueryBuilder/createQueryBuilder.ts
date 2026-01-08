import type {
  BaseConfigMap,
  EntityToken,
  IndexTokensOf,
} from '@karmaniverous/entity-manager';

import { type EntityClient } from '../EntityClient';
import { QueryBuilder } from './QueryBuilder';

/**
 * Options for {@link createQueryBuilder | `createQueryBuilder`}.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam ET - Entity token type.
 * @typeParam CF - Values-first config literal type carried by {@link EntityClient | `EntityClient`}.
 *
 * @category QueryBuilder
 */
export interface CreateQueryBuilderOptions<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF = unknown,
> {
  /** {@link EntityClient | `EntityClient`} instance. */
  entityClient: EntityClient<C, CF>;
  /** Entity token for the query. */
  entityToken: ET;
  /** Hash key token (global or sharded). */
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  /** Optional dehydrated page-key map string to resume paging. */
  pageKeyMap?: string | undefined;
}

/**
 * Create a token-/config-aware {@link QueryBuilder | `QueryBuilder`} with fully inferred generics.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam ET - Entity token type.
 * @typeParam CF - Values-first config literal type carried by {@link EntityClient | `EntityClient`}.
 *
 * @param options - {@link CreateQueryBuilderOptions | `CreateQueryBuilderOptions`} object.
 *
 * @returns A new {@link QueryBuilder | `QueryBuilder`} instance.
 *
 * @remarks
 * When `CF` is known, the returned builder narrows its index token type to `IndexTokensOf\<CF\>`. Otherwise it falls back to `string`.
 *
 * No explicit generics are required at the call site.
 *
 * @category QueryBuilder
 */
export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF,
>(
  options: CreateQueryBuilderOptions<C, ET, CF>,
): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>;

export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF,
>(
  options: CreateQueryBuilderOptions<C, ET, CF>,
): QueryBuilder<C, ET, IndexTokensOf<CF>, CF> {
  // Narrow ITS from CF captured on the client; no cf argument required.
  return new QueryBuilder<C, ET, IndexTokensOf<CF>, CF, unknown>(
    options as unknown as CreateQueryBuilderOptions<C, ET>,
  );
}
