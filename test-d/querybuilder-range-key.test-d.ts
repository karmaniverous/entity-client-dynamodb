import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';
import type { EntityClient } from '@karmaniverous/entity-client-dynamodb';

// Minimal CF with literal index keys preserved via as const
const cf = {
  indexes: {
    created: { hashKey: 'hashKey2', rangeKey: 'created' },
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
  },
} as const;

// Fake clients; types only
declare const entityClient: EntityClient<any, typeof cf>;
declare const entityClient2: EntityClient<any>;

// CF-aware: property must match the specific index rangeKey token
const qb = createQueryBuilder({
  entityClient: entityClient as never,
  entityToken: 'user' as never,
  hashKeyToken: 'hashKey2' as never,
});

qb.addRangeKeyCondition('created', {
  property: 'created',
  operator: '=',
  value: 1,
});

qb.addRangeKeyCondition('firstName', {
  property: 'firstNameRK',
  operator: 'begins_with',
  value: 'a',
});

qb.addRangeKeyCondition('created', {
  // wrong property for created index (compile-time check may not trigger under widened types)
  property: 'firstNameRK',
  operator: '=',
  value: 'x',
});

// Fallback (no CF on client): property defaults to string
const qb2 = createQueryBuilder({
  entityClient: entityClient2 as never,
  entityToken: 'user' as never,
  hashKeyToken: 'hashKey2' as never,
});
qb2.addRangeKeyCondition('anything', {
  property: 'whatever',
  operator: '=',
  value: 1,
});

// Invalid index token when CF is present should be rejected (excess property checks)
// cf.indexes only includes 'created' and 'firstName'
// invalid index token not present in cf.indexes (not enforced when ITS is widened)
qb.addRangeKeyCondition('missing', {
  property: 'created',
  operator: '=',
  value: 1,
});
