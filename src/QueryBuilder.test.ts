import { expect } from 'chai';

import { entityManager } from '../test/entityManager';
import { EntityClient } from './EntityClient';
import { QueryBuilder } from './QueryBuilder';

const entityClient = new EntityClient({
  region: process.env.AWS_DEFAULT_REGION,
});

let builder = new QueryBuilder({
  entityClient,
  entityManager,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
  tableName: 'UserTable',
});

describe('QueryBuilder - constructor', function () {
  beforeEach(function () {
    builder = new QueryBuilder({
      entityClient,
      entityManager,
      entityToken: 'user',
      hashKeyToken: 'hashKey2',
      tableName: 'UserTable',
    });
  });

  it('should create a QueryBuilder instance', function () {
    expect(builder).to.be.an.instanceof(QueryBuilder);
  });
});
