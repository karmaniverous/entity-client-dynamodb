import { expect } from 'chai';

import { EntityClient } from './EntityClient';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

const entityManagerClient = new EntityClient({
  region: process.env.AWS_DEFAULT_REGION,
});

let builder: ShardQueryMapBuilder<{ hashKey2: string }>;

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
