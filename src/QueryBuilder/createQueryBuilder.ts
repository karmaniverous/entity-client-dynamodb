import type {
  BaseConfigMap,
  EntityToken,
  IndexTokensOf,
} from '@karmaniverous/entity-manager';

import { EntityClient } from '../EntityClient';
import { QueryBuilder } from './QueryBuilder';

/**
 * Factory that produces a token-/config-aware QueryBuilder with fully inferred generics:
 * - ET inferred from options.entityToken
 * - CF inferred from options.cf
 * - ITS derived as IndexTokensOf<CF> (when CF carries indexes with literal keys)
 *
 * No generics are required at the call site.
 */
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
}) {
  const { cf: _cf, ...rest } = options;

  // CF/ITS flow into the typed instance; CF is not needed at runtime.
  return new QueryBuilder<C, ET, IndexTokensOf<CF>, CF>({
    ...rest,
  });
}

export default createQueryBuilder;
