import {
  addFilterCondition,
  addRangeKeyCondition,
  QueryBuilder,
} from '@karmaniverous/entity-client-dynamodb';
import type { MyConfigMap } from '../test/entityManager';

// Minimal, types-only builder instance
declare const qb: QueryBuilder<MyConfigMap>;

// Helper accepts generic BaseQueryBuilder + structural contract (no casts required)
addFilterCondition(qb, 'any-index', {
  operator: 'attribute_exists',
  property: 'created',
});

// Range key helper also accepts the builder without variance casts
addRangeKeyCondition(qb, 'any-index', {
  operator: '=',
  property: 'rangeKey',
  value: 'rk',
});

// Compile-only: if this file typechecks, the helpers are assignable from QueryBuilder<C, ...>
// and do not require downstream casts to a concrete builder type.
// No runtime assertions are needed for tsd.

export {};

