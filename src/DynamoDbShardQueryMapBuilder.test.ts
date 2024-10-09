import { expect } from 'chai';

import { entityManager, UserItem } from '../test/config';
import { DynamoDbEntityManagerClient } from './DynamoDbEntityManagerClient';
import { DynamoDbShardQueryMapBuilder } from './DynamoDbShardQueryMapBuilder';

const dynamoDbEntityManagerClient = new DynamoDbEntityManagerClient(
  {
    region: process.env.AWS_DEFAULT_REGION,
  },
  { logInternals: false },
);

describe('DynamoDbShardQueryMapBuilder', function () {
  describe('constructor', function () {
    it('should create a DynamoDbShardQueryMapBuilder instance', function () {
      const dynamoDbShardQueryMapBulder = new DynamoDbShardQueryMapBuilder({
        dynamoDbEntityManagerClient,
        entityManager,
        entityToken: 'user',
        hashKey: 'hashKey2',
        tableName: 'UserTable',
      });

      expect(dynamoDbShardQueryMapBulder).to.be.an.instanceof(
        DynamoDbShardQueryMapBuilder,
      );
    });
  });
});
