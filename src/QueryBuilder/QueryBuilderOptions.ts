import type {
  BaseConfigMap,
  BaseQueryBuilderOptions,
} from '@karmaniverous/entity-manager';

import { EntityClient } from '../EntityClient';

/**
 * {@link QueryBuilder | `QueryBuilder`} constructor options.
 *
 * @category QueryBuilder
 */
export interface QueryBuilderOptions<C extends BaseConfigMap>
  extends BaseQueryBuilderOptions<C, EntityClient<C>> {
  /** Table name. */
  tableName: string;
}
