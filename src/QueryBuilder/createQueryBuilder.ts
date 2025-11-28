import type {
  BaseConfigMap,
  EntityToken,
  IndexTokensOf,
} from '@karmaniverous/entity-manager';

import { EntityClient } from '../EntityClient';
import { QueryBuilder } from './QueryBuilder';

/**
 * Factory that produces a token-/config-aware QueryBuilder with fully inferred generics.
 *
 * Automatic inference:
 * - CF (values-first config literal) is captured by EntityManager via createEntityManager(config as const)
 *   and threaded through EntityClient\<C, CF\>. ITS derives as IndexTokensOf<CF>.
 * - Without a values-first literal (CF=unknown), ITS defaults to string.
 *
 * No generics are required at the call site.
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
