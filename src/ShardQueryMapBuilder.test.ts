import { expect } from 'chai';

import { entityManager } from '../test/entityManager';
import { EntityClient } from './EntityClient';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

const entityClient = new EntityClient({
  region: process.env.AWS_DEFAULT_REGION,
});

let builder = new ShardQueryMapBuilder(
  entityClient,
  'UserTable',
  entityManager,
  'user',
  'hashKey2',
);

describe('ShardQueryMapBuilder - constructor', function () {
  beforeEach(function () {
    builder = new ShardQueryMapBuilder(
      entityClient,
      'UserTable',
      entityManager,
      'user',
      'hashKey2',
    );
  });

  it('should create a ShardQueryMapBuilder instance', function () {
    expect(builder).to.be.an.instanceof(ShardQueryMapBuilder);
  });
});
