import { beforeEach, describe, expect, it } from 'vitest';

import { entityManager } from '../../test/entityManager';
import { EntityClient } from '../EntityClient';
import { QueryBuilder } from '../QueryBuilder';

const entityClient = new EntityClient({
  entityManager,
  region: process.env.AWS_DEFAULT_REGION,
  tableName: 'UserTable',
});

let builder = new QueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});

describe('QueryBuilder - constructor', function () {
  beforeEach(function () {
    builder = new QueryBuilder({
      entityClient,
      entityToken: 'user',
      hashKeyToken: 'hashKey2',
    });
  });

  it('should create a QueryBuilder instance', function () {
    expect(builder).to.be.an.instanceof(QueryBuilder);
  });
});
