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
 * Overloads:
 * - Without `cf`: ET is inferred; ITS defaults to `string`; CF defaults to `unknown`.
 * - With `cf`: ET is inferred; ITS derives as IndexTokensOf<CF>; CF is threaded for page-key narrowing.
 *
 * No generics are required at the call site.
 */
export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
>(options: {
  entityClient: EntityClient<C>;
  entityToken: ET;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  pageKeyMap?: string;
}): QueryBuilder<C, ET>;

export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF,
>(options: {
  entityClient: EntityClient<C>;
  entityToken: ET;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  cf: CF;
  pageKeyMap?: string;
}): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>;

export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF,
>(
  options:
    | {
        entityClient: EntityClient<C>;
        entityToken: ET;
        hashKeyToken: C['HashKey'] | C['ShardedKeys'];
        pageKeyMap?: string;
      }
    | {
        entityClient: EntityClient<C>;
        entityToken: ET;
        hashKeyToken: C['HashKey'] | C['ShardedKeys'];
        cf: CF;
        pageKeyMap?: string;
      },
) {
  if ('cf' in options) {
    const { cf, ...rest } = options;
    void cf;
    return new QueryBuilder<C, ET, IndexTokensOf<CF>, CF, unknown>({ ...rest });
  }
  return new QueryBuilder<C, ET, string, unknown, unknown>(options);
}
