import { expect } from 'chai';

import { EntityManagerClient } from './EntityManagerClient';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

const entityManagerClient = new EntityManagerClient({
  region: process.env.AWS_DEFAULT_REGION,
});

let builder: ShardQueryMapBuilder;

describe('ShardQueryMapBuilder - constructor', function () {
  beforeEach(function () {
    builder = new ShardQueryMapBuilder({
      doc: entityManagerClient.doc,
      hashKeyToken: 'hashKey2',
      tableName: 'UserTable',
    });
  });

  it('should create a ShardQueryMapBuilder instance', function () {
    expect(builder).to.be.an.instanceof(ShardQueryMapBuilder);
  });
});
