import type { BaseConfigMap, EntityItem } from '@karmaniverous/entity-manager';

import { EntityKey } from './EntityKey';

export type EntityRecord<C extends BaseConfigMap> = EntityItem<C> &
  EntityKey<C>;
