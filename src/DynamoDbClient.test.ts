import { type CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import { expect } from 'chai';
import { nanoid } from 'nanoid';
import { range } from 'radash';

import { DynamoDbClient } from './DynamoDbClient';

const dynamoDbClient = new DynamoDbClient({
  logInternals: false,
  region: process.env.AWS_DEFAULT_REGION,
});

const tableOptions: Omit<CreateTableCommandInput, 'TableName'> = {
  AttributeDefinitions: [
    { AttributeName: 'hashKey', AttributeType: 'S' },
    { AttributeName: 'rangeKey', AttributeType: 'N' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
  KeySchema: [
    { AttributeName: 'hashKey', KeyType: 'HASH' },
    { AttributeName: 'rangeKey', KeyType: 'RANGE' },
  ],
};

describe('WrappedDynamoDbClient', function () {
  describe('constructor', function () {
    it('should create a DynamoDbClient instance', function () {
      expect(dynamoDbClient).to.be.an.instanceof(DynamoDbClient);
    });
  });

  describe('tables', function () {
    describe('validations', function () {
      it('create/delete should close', async function () {
        const tableName = nanoid();

        // Create table.
        const { waiterResult: createResult } = await dynamoDbClient.createTable(
          {
            ...tableOptions,
            TableName: tableName,
          },
        );

        expect(createResult.state).to.equal('SUCCESS');

        // Delete table.
        const { waiterResult: deleteResult } = await dynamoDbClient.deleteTable(
          { TableName: tableName },
        );

        expect(deleteResult.state).to.equal('SUCCESS');
      });
    });

    describe('create ... delete', function () {
      let tableName: string;

      before(async function () {
        tableName = nanoid();

        // Create table.
        await dynamoDbClient.createTable({
          ...tableOptions,
          TableName: tableName,
        });
      });

      after(async function () {
        // Delete table.
        await dynamoDbClient.deleteTable({ TableName: tableName });
      });

      describe('items', function () {
        describe('validations', function () {
          it('put/delete should close', async function () {
            const item = { hashKey: nanoid(), rangeKey: 0 };

            // Put item.
            const putResponse = await dynamoDbClient.putItem({
              Item: item,
              TableName: tableName,
            });

            expect(putResponse.$metadata.httpStatusCode).to.equal(200);

            // Delete item.
            const deleteResponse = await dynamoDbClient.deleteItem({
              Key: item,
              TableName: tableName,
            });

            expect(deleteResponse.$metadata.httpStatusCode).to.equal(200);
          });

          it('puts/deletes should close', async function () {
            const hashKey = nanoid();
            const items = [...range(96)].map((rangeKey) => ({
              hashKey,
              rangeKey,
            }));

            // Put items.
            const putResponse = await dynamoDbClient.putItems(tableName, items);

            expect(putResponse.every((r) => r.$metadata.httpStatusCode === 200))
              .to.be.true;

            // Query items.
            const putScan = await dynamoDbClient.doc.scan({
              TableName: tableName,
            });

            expect(putScan.Items).not.to.be.empty;

            // Delete items.
            const deleteResponse = await dynamoDbClient.deleteItems(
              tableName,
              items,
            );

            expect(
              deleteResponse.every((r) => r.$metadata.httpStatusCode === 200),
            ).to.be.true;

            // Query items.
            const deleteScan = await dynamoDbClient.doc.scan({
              TableName: tableName,
            });

            expect(deleteScan.Items).to.be.empty;
          });

          it('puts/purge should close', async function () {
            const hashKey = nanoid();
            const items = [...range(96)].map((rangeKey) => ({
              hashKey,
              rangeKey,
            }));

            // Put items.
            const putResponse = await dynamoDbClient.putItems(tableName, items);

            expect(putResponse.every((r) => r.$metadata.httpStatusCode === 200))
              .to.be.true;

            // Query items.
            const putScan = await dynamoDbClient.doc.scan({
              TableName: tableName,
            });

            expect(putScan.Items).not.to.be.empty;

            // Purge items.
            const purged = await dynamoDbClient.purgeItems(
              tableName,
              'hashKey',
              'rangeKey',
            );

            expect(purged).to.equal(97);

            // Query items.
            const deleteScan = await dynamoDbClient.doc.scan({
              TableName: tableName,
            });

            expect(deleteScan.Items).to.be.empty;
          });
        });
      });
    });
  });
});
