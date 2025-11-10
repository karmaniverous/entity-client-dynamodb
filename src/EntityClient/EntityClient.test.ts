import { type CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import {
  dynamoDbLocalReady,
  setupDynamoDbLocal,
  teardownDynamoDbLocal,
} from '@karmaniverous/dynamodb-local';
import type { EntityRecord } from '@karmaniverous/entity-manager';
import { nanoid } from 'nanoid';
import { pick, range } from 'radash';
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { entityManager, type MyConfigMap } from '../../test/entityManager';
import { env } from '../env';
import { generateTableDefinition } from '../Tables';
import { EntityClient } from './EntityClient';
import type { EntityClientOptions } from './EntityClientOptions';

const entityClientOptions: Omit<
  EntityClientOptions<MyConfigMap>,
  'tableName'
> = {
  credentials: {
    accessKeyId: 'fakeAccessKeyId',
    secretAccessKey: 'fakeSecretAccessKey',
  },
  endpoint: 'http://localhost:8000',
  entityManager,
  region: 'local',
};

const tableOptions: Omit<CreateTableCommandInput, 'TableName'> = {
  BillingMode: 'PAY_PER_REQUEST',
  ...generateTableDefinition(entityManager),
};

let entityClient: EntityClient<MyConfigMap>;

describe('EntityClient', function () {
  before(async function () {
    entityClient = new EntityClient<MyConfigMap>({
      tableName: 'EntityClientTest',
      ...entityClientOptions,
    });

    await setupDynamoDbLocal(env.dynamoDbLocalPort);
    await dynamoDbLocalReady(entityClient.client);
  });

  describe('constructor', function () {
    it('should create a EntityClient instance', function () {
      expect(entityClient).to.be.an.instanceof(EntityClient);
    });
  });

  describe('tables', function () {
    describe('validations', function () {
      it('create/delete should close', async function () {
        const tableName = nanoid();

        entityClient = new EntityClient<MyConfigMap>({
          tableName,
          ...entityClientOptions,
        });

        // Create table.
        const { waiterResult: createResult } = await entityClient.createTable({
          ...tableOptions,
        });

        expect(createResult.state).to.equal('SUCCESS');

        // Delete table.
        const { waiterResult: deleteResult } = await entityClient.deleteTable();

        expect(deleteResult.state).to.equal('SUCCESS');
      });
    });

    describe('create ... delete', function () {
      let tableName: string;

      before(async function () {
        tableName = nanoid();

        entityClient = new EntityClient<MyConfigMap>({
          tableName,
          ...entityClientOptions,
        });

        // Create table.
        await entityClient.createTable({ ...tableOptions });
      });

      after(async function () {
        // Delete table.
        await entityClient.deleteTable();
      });

      describe('items', function () {
        describe('validations', function () {
          it('put/delete should close', async function () {
            const item = { hashKey2: nanoid(), rangeKey: 'abc' };

            // Put item.
            const putResponse = await entityClient.putItem({ Item: item });

            expect(putResponse.$metadata.httpStatusCode).to.equal(200);

            // Delete item.
            const deleteResponse = await entityClient.deleteItem({ Key: item });

            expect(deleteResponse.$metadata.httpStatusCode).to.equal(200);
          });

          it('puts/deletes should close', async function () {
            const hashKey2 = nanoid();
            const items = [...range(96)].map(() => ({
              hashKey2,
              rangeKey: nanoid(),
            }));

            // Put items.
            const putResponse = await entityClient.putItems(items);

            expect(putResponse.every((r) => r.$metadata.httpStatusCode === 200))
              .to.be.true;

            // Query items.
            const putScan = await entityClient.doc.scan({
              TableName: tableName,
            });

            expect(putScan.Items).not.to.be.empty;

            // Delete items.
            const deleteResponse = await entityClient.deleteItems(items);

            expect(
              deleteResponse.every((r) => r.$metadata.httpStatusCode === 200),
            ).to.be.true;

            // Query items.
            const deleteScan = await entityClient.doc.scan({
              TableName: tableName,
            });

            expect(deleteScan.Items).to.be.empty;
          });

          it('puts/purge should close', async function () {
            const hashKey2 = nanoid();
            const items = [...range(96)].map(() => ({
              hashKey2,
              rangeKey: nanoid(),
            }));

            // Put items.
            const putResponse = await entityClient.putItems(items);

            expect(putResponse.every((r) => r.$metadata.httpStatusCode === 200))
              .to.be.true;

            // Query items.
            const putScan = await entityClient.doc.scan({
              TableName: tableName,
            });

            expect(putScan.Items).not.to.be.empty;

            // Purge items.
            const purged = await entityClient.purgeItems();

            expect(purged).to.equal(97);

            // Query items.
            const deleteScan = await entityClient.doc.scan({
              TableName: tableName,
            });

            expect(deleteScan.Items).to.be.empty;
          });

          it('transact puts/deletes should close', async function () {
            const hashKey2 = nanoid();
            const items = [...range(96)].map(() => ({
              hashKey2,
              rangeKey: nanoid(),
            }));

            // Put items.
            const putResponse = await entityClient.transactPutItems(items);

            expect(putResponse.$metadata.httpStatusCode).to.equal(200);

            // Query items.
            const putScan = await entityClient.doc.scan({
              TableName: tableName,
            });

            expect(putScan.Items).not.to.be.empty;

            // Delete items.
            const deleteResponse =
              await entityClient.transactDeleteItems(items);

            expect(deleteResponse.$metadata.httpStatusCode).to.equal(200);

            // Query items.
            const deleteScan = await entityClient.doc.scan({
              TableName: tableName,
            });

            expect(deleteScan.Items).to.be.empty;
          });

          describe('put ... delete', function () {
            let hashKey2: string;

            let item0: EntityRecord<MyConfigMap>;
            let item1: EntityRecord<MyConfigMap>;

            beforeEach(async function () {
              hashKey2 = nanoid();
              item0 = { hashKey2, rangeKey: '0', a0: 'foo', a1: 'bar' };
              item1 = { hashKey2, rangeKey: '1', a0: 'baz', a1: 'qux' };

              // Put items.
              await entityClient.putItem(item0);
              await entityClient.putItem(item1);
            });

            afterEach(async function () {
              // Delete items.
              await entityClient.deleteItem(
                pick(item0, ['hashKey2', 'rangeKey']),
              );
              await entityClient.deleteItem(
                pick(item1, ['hashKey2', 'rangeKey']),
              );
            });

            describe('get', function () {
              it('should get items', async function () {
                // Get item.
                const response0 = await entityClient.getItem(
                  pick(item0, ['hashKey2', 'rangeKey']),
                );
                expect(response0.Item).to.deep.equal(item0);

                const response1 = await entityClient.getItem(
                  pick(item1, ['hashKey2', 'rangeKey']),
                );
                expect(response1.Item).to.deep.equal(item1);
              });

              it('should get designated attributes', async function () {
                // Get item.
                const response0 = await entityClient.getItem(
                  pick(item0, ['hashKey2', 'rangeKey']),
                  ['a0'],
                );
                expect(response0.Item).to.deep.equal(pick(item0, ['a0']));
              });

              it('should fail to get nonexistent item', async function () {
                const item2 = { hashKey2, rangeKey: '2' };

                // Get item.
                const response = await entityClient.getItem(item2);
                expect(response.Item).not.to.exist;
              });
            });

            describe('gets', function () {
              it('should get multiple items', async function () {
                // Get items.
                const response = await entityClient.getItems([
                  pick(item0, ['hashKey2', 'rangeKey']),
                  pick(item1, ['hashKey2', 'rangeKey']),
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

  after(async function () {
    await teardownDynamoDbLocal();
  });
});
