import { expect } from 'chai';

import { getUsers } from '../test/users';
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
      const [user] = getUsers();

      const dynamoDbShardQueryMapBulder = new DynamoDbShardQueryMapBuilder({
        dynamoDbEntityManagerClient,
        entityToken: 'user',
        hashKeyToken: 'hashKey2',
        item: user,
        tableName: 'UserTable',
      });

      expect(dynamoDbShardQueryMapBulder).to.be.an.instanceof(
        DynamoDbShardQueryMapBuilder,
      );
    });
  });
});
