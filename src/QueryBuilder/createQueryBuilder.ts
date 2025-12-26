import type {
  BaseConfigMap,
  EntityToken,
  IndexTokensOf,
} from '@karmaniverous/entity-manager';

import { EntityClient } from '../EntityClient';
import { QueryBuilder } from './QueryBuilder';

/**
 * Create a token-/config-aware {@link QueryBuilder | `QueryBuilder`} with fully inferred generics.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam ET - Entity token type.
 * @typeParam CF - Values-first config literal type carried by {@link EntityClient | `EntityClient`}.
 *
 * @param options - Builder inputs.
 * @param options.entityClient - {@link EntityClient | `EntityClient`} instance.
 * @param options.entityToken - Entity token for the query.
 * @param options.hashKeyToken - Hash key token (global or sharded).
 * @param options.pageKeyMap - Optional dehydrated page-key map string to resume paging.
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
>(options: {
  entityClient: EntityClient<C, CF>;
  entityToken: ET;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  pageKeyMap?: string | undefined;
}): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>;

export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF,
>(options: {
  entityClient: EntityClient<C, CF>;
  entityToken: ET;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  pageKeyMap?: string | undefined;
}): QueryBuilder<C, ET, IndexTokensOf<CF>, CF> {
  // Narrow ITS from CF captured on the client; no cf argument required.
  return new QueryBuilder<C, ET, IndexTokensOf<CF>, CF, unknown>(
    options as unknown as {
      entityClient: EntityClient<C>;
      entityToken: ET;
      hashKeyToken: C['HashKey'] | C['ShardedKeys'];
      pageKeyMap?: string;
    },
  );
}
