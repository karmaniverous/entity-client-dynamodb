import { expect } from 'chai';

import { DynamoDbEntityManagerClient } from './DynamoDbEntityManagerClient';
import { DynamoDbShardQueryMapBuilder } from './DynamoDbShardQueryMapBuilder';

const dynamoDbEntityManagerClient = new DynamoDbEntityManagerClient({
  region: process.env.AWS_DEFAULT_REGION,
});

describe('DynamoDbShardQueryMapBuilder', function () {
  describe('constructor', function () {
    it('should create a DynamoDbShardQueryMapBuilder instance', function () {
      const dynamoDbShardQueryMapBulder = new DynamoDbShardQueryMapBuilder({
        dynamoDBDocument: dynamoDbEntityManagerClient.doc,
        entityToken: 'user',
        hashKeyToken: 'hashKey2',
        tableName: 'UserTable',
      });

      expect(dynamoDbShardQueryMapBulder).to.be.an.instanceof(
        DynamoDbShardQueryMapBuilder,
      );
    });
  });
});
