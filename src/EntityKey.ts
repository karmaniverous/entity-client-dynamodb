import { BaseConfigMap } from '@karmaniverous/entity-manager';

export type EntityKey<C extends BaseConfigMap> = Record<
  C['HashKey'] | C['RangeKey'],
  string
>;
