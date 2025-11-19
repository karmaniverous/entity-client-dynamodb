import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';

// Minimal CF with literal index keys preserved via as const
const cf = {
  indexes: {
    created: { hashKey: 'hashKey2', rangeKey: 'created' },
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
  },
} as const;

// Fake client; types only
declare const entityClient: unknown;

// CF-aware: property must match the specific index rangeKey token
const qb = createQueryBuilder({
  entityClient: entityClient as never,
  entityToken: 'user' as never,
  hashKeyToken: 'hashKey2' as never,
  cf,
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
  // @ts-expect-error wrong property for created index
  property: 'firstNameRK',
  operator: '=',
  value: 'x',
});

// Fallback (no CF): property defaults to string
const qb2 = createQueryBuilder({
  entityClient: entityClient as never,
  entityToken: 'user' as never,
  hashKeyToken: 'hashKey2' as never,
});
qb2.addRangeKeyCondition('anything', { property: 'whatever', operator: '=', value: 1 });
