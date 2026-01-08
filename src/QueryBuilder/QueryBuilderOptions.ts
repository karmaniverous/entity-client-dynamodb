import type {
  BaseConfigMap,
  BaseQueryBuilderOptions,
} from '@karmaniverous/entity-manager';

import { type EntityClient } from '../EntityClient';

/**
 * {@link QueryBuilder | `QueryBuilder`} constructor options.
 *
 * This is a specialization of {@link BaseQueryBuilderOptions | `BaseQueryBuilderOptions`} for {@link EntityClient | `EntityClient`}.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam CF - Values-first config literal type carried by {@link EntityClient | `EntityClient`}.
 *
 * @category QueryBuilder
 */
export type QueryBuilderOptions<
  C extends BaseConfigMap,
  CF = unknown,
> = BaseQueryBuilderOptions<C, EntityClient<C, CF>>;
