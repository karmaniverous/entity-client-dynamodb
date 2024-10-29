import { type CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import { expect } from 'chai';
import { nanoid } from 'nanoid';
import { pick, range } from 'radash';

import { EntityClient } from './EntityClient';

const dynamoDbClient = new EntityClient({
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

describe('EntityClient', function () {
  describe('constructor', function () {
    it('should create a EntityClient instance', function () {
      expect(dynamoDbClient).to.be.an.instanceof(EntityClient);
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

          it('transact puts/deletes should close', async function () {
            const hashKey = nanoid();
            const items = [...range(96)].map((rangeKey) => ({
              hashKey,
              rangeKey,
            }));

            // Put items.
            const putResponse = await dynamoDbClient.transactPutItems(
              tableName,
              items,
            );

            expect(putResponse.$metadata.httpStatusCode).to.equal(200);

            // Query items.
            const putScan = await dynamoDbClient.doc.scan({
              TableName: tableName,
            });

            expect(putScan.Items).not.to.be.empty;

            // Delete items.
            const deleteResponse = await dynamoDbClient.transactDeleteItems(
              tableName,
              items,
            );

            expect(deleteResponse.$metadata.httpStatusCode).to.equal(200);

            // Query items.
            const deleteScan = await dynamoDbClient.doc.scan({
              TableName: tableName,
            });

            expect(deleteScan.Items).to.be.empty;
          });

          describe('put ... delete', function () {
            let hashKey: string;

            interface Item {
              hashKey: string;
              rangeKey: number;
              a0: string;
              a1: string;
            }
            let item0: Item;
            let item1: Item;

            beforeEach(async function () {
              hashKey = nanoid();
              item0 = { hashKey, rangeKey: 0, a0: 'foo', a1: 'bar' };
              item1 = { hashKey, rangeKey: 1, a0: 'baz', a1: 'qux' };

              // Put items.
              await dynamoDbClient.putItem(tableName, item0);
              await dynamoDbClient.putItem(tableName, item1);
            });

            afterEach(async function () {
              // Delete items.
              await dynamoDbClient.deleteItem(
                tableName,
                pick(item0, ['hashKey', 'rangeKey']),
              );
              await dynamoDbClient.deleteItem(
                tableName,
                pick(item1, ['hashKey', 'rangeKey']),
              );
            });

            describe('get', function () {
              it('should get items', async function () {
                // Get item.
                const response0 = await dynamoDbClient.getItem(
                  tableName,
                  pick(item0, ['hashKey', 'rangeKey']),
                );
                expect(response0.Item).to.deep.equal(item0);

                const response1 = await dynamoDbClient.getItem(
                  tableName,
                  pick(item1, ['hashKey', 'rangeKey']),
                );
                expect(response1.Item).to.deep.equal(item1);
              });

              it('should get designated attributes', async function () {
                // Get item.
                const response0 = await dynamoDbClient.getItem(
                  tableName,
                  pick(item0, ['hashKey', 'rangeKey']),
                  ['a0'],
                );
                expect(response0.Item).to.deep.equal(pick(item0, ['a0']));
              });

              it('should fail to get nonexistent item', async function () {
                const item2 = { hashKey, rangeKey: 2 };

                // Get item.
                const response = await dynamoDbClient.getItem(tableName, item2);
                expect(response.Item).not.to.exist;
              });
            });

            describe('gets', function () {
              it('should get multiple items', async function () {
                // Get items.
                const response = await dynamoDbClient.getItems(tableName, [
                  pick(item0, ['hashKey', 'rangeKey']),
                  pick(item1, ['hashKey', 'rangeKey']),
                ]);
                expect(response.items)
                  .to.deep.include(item0)
                  .and.to.deep.include(item1);
              });
            });
          });
        });
      });
    });
  });
});
