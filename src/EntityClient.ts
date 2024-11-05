import {
  CreateTableCommand,
  type CreateTableCommandInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type CreateTableCommandOutput,
  DeleteTableCommand,
  type DeleteTableCommandInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type DeleteTableCommandOutput,
  DynamoDBClient,
  type DynamoDBClientConfig,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import {
  type BatchGetCommandOutput,
  type BatchWriteCommandOutput,
  type DeleteCommandInput,
  type DeleteCommandOutput,
  DynamoDBDocument,
  type GetCommandOutput,
  type PutCommandInput,
  type PutCommandOutput,
  type TransactWriteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import {
  batchProcess,
  type BatchProcessOptions,
} from '@karmaniverous/batch-process';
import { EntityManager, type EntityMap } from '@karmaniverous/entity-manager';
import type {
  Exactify,
  PropertiesOfType,
  TranscodeMap,
  WithRequiredAndNonNullable,
} from '@karmaniverous/entity-tools';
import AWSXray from 'aws-xray-sdk';
import { isArray, isString, pick, sift, zipToObject } from 'radash';

import type { GetItemOptions } from './GetItemOptions';
import type { Item } from './Item';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

/**
 * DynamoDB EntityClient options. Extends {@link DynamoDBClientConfig | `DynamoDBClientConfig`} with the following additional properties:
 * - `batchProcessOptions` - Default batch process options.
 * - `enableXray` - Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment.
 * - `logger` - Injected logger object. Must support `debug` and `error` methods. Default: `console`.
 *
 * @category EntityClient
 */
export interface EntityClientOptions
  extends Omit<DynamoDBClientConfig, 'logger'> {
  /** Default batch process options. */
  batchProcessOptions?: Omit<
    BatchProcessOptions<unknown, unknown>,
    'batchHandler' | 'unprocessedItemExtractor'
  >;

  /** Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment. */
  enableXray?: boolean;

  /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
  logger?: Pick<Console, 'debug' | 'error'>;
}

/**
 * Convenience wrapper around the AWS SDK {@link DynamoDBClient | `DynamoDBClient`} and {@link DynamoDBDocument | `DynamoDBDocument`} classes with enhanced batch processing.
 *
 * @remarks
 * This class provides a number of enhanced methods. For everything else, both the {@link DynamoDBClient | `DynamoDBClient`} and {@link DynamoDBDocument | `DynamoDBDocument`} instances are exposed for direct access on the {@link EntityClient.client | `client`} and {@link EntityClient.doc | `doc`} properties, respectively.
 *
 * @category EntityClient
 */
export class EntityClient {
  #batchProcessOptions: NonNullable<EntityClientOptions['batchProcessOptions']>;
  #client: DynamoDBClient;
  #doc: DynamoDBDocument;
  #logger: NonNullable<EntityClientOptions['logger']>;

  /**
   * DynamoDB EntityClient constructor.
   *
   * @param options - {@link EntityClientOptions | `EntityClientOptions`} object.
   */
  constructor(options: EntityClientOptions = {}) {
    const {
      batchProcessOptions = {},
      enableXray = false,
      logger = console,
      ...dynamoDbClientConfig
    } = options;

    this.#batchProcessOptions = batchProcessOptions;

    const client = new DynamoDBClient(dynamoDbClientConfig);

    this.#client =
      enableXray && process.env.AWS_XRAY_DAEMON_ADDRESS
        ? AWSXray.captureAWSv3Client(client)
        : client;

    this.#doc = DynamoDBDocument.from(this.#client, {
      marshallOptions: { removeUndefinedValues: true },
    });

    this.#logger = logger;
  }

  /**
   * Returns the default {@link BatchProcessOptions | batch process options}, not including handler functions.
   */
  get batchProcessOptions() {
    return this.#batchProcessOptions;
  }

  /**
   * Returns the internal AWS SDK DynamoDBClient instance.
   */
  get client() {
    return this.#client;
  }

  /**
   * Returns the internal AWS SDK DynamoDBDocument instance.
   */
  get doc() {
    return this.#doc;
  }

  /**
   * Returns the injected logger instance.
   */
  get logger() {
    return this.#logger;
  }

  /* eslint-disable tsdoc/syntax */
  /**
   * Creates a DynamoDB table using {@link CreateTableCommand | `CreateTableCommand`} and waits for the table to be created and available using {@link waitUntilTableExists | `waitUntilTableExists`}.
   *
   * @param options - {@link CreateTableCommandInput | `CreateTableCommandInput`} object with the `TableName` property required and non-nullable.
   * @param waiterConfig - {@link smithy!waiter | `WaiterConfiguration`} with `client` parameter omitted & `maxWaitTime` defaulted to 60s.
   *
   * @returns An object containing the resulting {@link CreateTableCommandOutput | `CreateTableCommandOutput`} and {@link smithy!WaiterResult | `WaiterResult`} objects.
   */
  /* eslint-enable tsdoc/syntax */
  async createTable(
    options: WithRequiredAndNonNullable<CreateTableCommandInput, 'TableName'>,
    waiterConfig: Omit<Parameters<typeof waitUntilTableExists>[0], 'client'> = {
      maxWaitTime: 60,
    },
  ) {
    try {
      // Validate options.
      if (!options.TableName) throw new Error('TableName is required');

      // Send command.
      const createTableCommandOutput = await this.client.send(
        new CreateTableCommand(options),
      );

      if (!createTableCommandOutput.TableDescription?.TableStatus) {
        const msg = 'table creation request failed';
        this.logger.error(msg, createTableCommandOutput);
        throw new Error(msg);
      }

      // Await table creation.
      const waiterResult = await waitUntilTableExists(
        { client: this.client, ...waiterConfig },
        { TableName: options.TableName },
      );

      this.logger.debug('created table', {
        options,
        createTableCommandOutput,
        waiterResult,
      });

      return { createTableCommandOutput, waiterResult };
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, { options });

      throw error;
    }
  }

  /* eslint-disable tsdoc/syntax */
  /**
   * Deletes a DynamoDB table using {@link DeleteTableCommand | `DeleteTableCommand`} and waits for the table to be confirmed deleted with {@link waitUntilTableNotExists | `waitUntilTableNotExists`}.
   *
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/DeleteTableCommandInput | `DeleteTableCommandInput`} object with the `TableName` property required and non-nullable.
   * @param waiterConfig - {@link smithy!waiter | `WaiterConfiguration`} with `client` parameter omitted & `maxWaitTime` defaulted to 60s.
   *
   * @returns An object containing the resulting {@link DeleteTableCommandOutput | `DeleteTableCommandOutput`} and {@link smithy!WaiterResult | `WaiterResult`} objects.
   */
  /* eslint-enable tsdoc/syntax */
  async deleteTable(
    options: WithRequiredAndNonNullable<DeleteTableCommandInput, 'TableName'>,
    waiterConfig: Omit<
      Parameters<typeof waitUntilTableNotExists>[0],
      'client'
    > = {
      maxWaitTime: 60,
    },
  ) {
    try {
      // Validate options.
      if (!options.TableName) throw new Error('TableName is required');

      // Send command.
      const deleteTableCommandOutput = await this.client.send(
        new DeleteTableCommand(options),
      );

      if (!deleteTableCommandOutput.TableDescription?.TableStatus) {
        const msg = 'table deletion request failed';
        this.logger.error(msg, deleteTableCommandOutput);
        throw new Error(msg);
      }

      // Await table deletion.
      const waiterResult = await waitUntilTableNotExists(
        { client: this.client, ...waiterConfig },
        { TableName: options.TableName },
      );

      this.logger.debug('deleted table', {
        options,
        deleteTableCommandOutput,
        waiterResult,
      });

      return { deleteTableCommandOutput, waiterResult };
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, { options });

      throw error;
    }
  }

  /**
   * Puts an item to a DynamoDB table.
   *
   * @param tableName - Table name.
   * @param item - Item.
   *
   * @returns The resulting {@link PutCommandOutput | `PutCommandOutput`} object.
   *
   * @overload
   */
  async putItem(tableName: string, item: Item): Promise<PutCommandOutput>;
  /**
   * Puts an item to a DynamoDB table.
   *
   * @param options - {@link PutCommandInput | `PutCommandInput`} object with the `Item` & `TableName` properties required and non-nullable.
   *
   * @returns The resulting {@link PutCommandOutput | `PutCommandOutput`} object.
   *
   * @overload
   */
  async putItem(
    options: WithRequiredAndNonNullable<PutCommandInput, 'Item' | 'TableName'>,
  ): Promise<PutCommandOutput>;
  async putItem(
    optionsOrTableName:
      | WithRequiredAndNonNullable<PutCommandInput, 'Item' | 'TableName'>
      | string,
    item?: Item,
  ): Promise<PutCommandOutput> {
    // Normalize params.
    let options: WithRequiredAndNonNullable<
      PutCommandInput,
      'Item' | 'TableName'
    >;

    if (isString(optionsOrTableName)) {
      if (!optionsOrTableName) throw new Error('tableName is required');
      if (!item) throw new Error('item is required');

      options = { Item: item, TableName: optionsOrTableName };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!optionsOrTableName.Item) throw new Error('options.Item is required');
      if (!optionsOrTableName.TableName)
        throw new Error('options.TableName is required');

      options = optionsOrTableName;
    }

    try {
      // Send command.
      const response = await this.doc.put(options);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.logger.debug('put item to table', {
          options,
          response,
        });
      else {
        const msg = 'failed to put item to table';
        this.logger.error(msg, response);
        throw new Error(msg);
      }

      return response;
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, options);

      throw error;
    }
  }

  /**
   * Deletes an item from a DynamoDB table.
   *
   * @param tableName - Table name.
   * @param key - Item key.
   *
   * @returns The resulting {@link DeleteCommandOutput | `DeleteCommandOutput`} object.
   *
   * @overload
   */
  async deleteItem(tableName: string, key: Item): Promise<DeleteCommandOutput>;
  /**
   * Deletes an item from a DynamoDB table.
   * @param options - {@link DeleteCommandInput | `DeleteCommandInput`} object with the `Key` & `TableName` properties required and non-nullable.
   * @returns The resulting {@link DeleteCommandOutput | `DeleteCommandOutput`} object.
   * @overload
   */
  async deleteItem(
    options: WithRequiredAndNonNullable<
      DeleteCommandInput,
      'Key' | 'TableName'
    >,
  ): Promise<DeleteCommandOutput>;
  async deleteItem(
    optionsOrTableName:
      | WithRequiredAndNonNullable<DeleteCommandInput, 'Key' | 'TableName'>
      | string,
    key?: Item,
  ): Promise<DeleteCommandOutput> {
    // Normalize params.
    let options: WithRequiredAndNonNullable<
      DeleteCommandInput,
      'Key' | 'TableName'
    >;

    if (isString(optionsOrTableName)) {
      if (!optionsOrTableName) throw new Error('tableName is required');
      if (!key) throw new Error('key is required');

      options = { Key: key, TableName: optionsOrTableName };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!optionsOrTableName.Key) throw new Error('options.Key is required');
      if (!optionsOrTableName.TableName)
        throw new Error('options.TableName is required');

      options = optionsOrTableName;
    }

    try {
      // Send command.
      const response = await this.doc.delete(options);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.logger.debug('deleted item from table', {
          options,
          response,
        });
      else {
        const msg = 'failed to delete item from table';
        this.logger.error(msg, { options, response });
        throw new Error(msg);
      }

      return response;
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, options);

      throw error;
    }
  }

  /**
   * Puts multiple items to a DynamoDB table in batches.
   *
   * @param tableName - Table name.
   * @param items - Array of items.
   * @param batchProcessOptions - Batch process option overrides.
   *
   * @returns Array of {@link BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async putItems(
    tableName: string,
    items: Item[],
    batchProcessOptions: EntityClientOptions['batchProcessOptions'] = {},
  ): Promise<BatchWriteCommandOutput[]> {
    // Validate options.
    if (!tableName) throw new Error('tableName is required');

    try {
      const batchHandler = async (batch: Item[]) =>
        await this.doc.batchWrite({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        });

      const unprocessedItemExtractor = (output: BatchWriteCommandOutput) =>
        output.UnprocessedItems?.[tableName];

      const outputs = await batchProcess(items, {
        batchHandler,
        unprocessedItemExtractor,
        ...Object.assign(batchProcessOptions, this.batchProcessOptions),
      });

      this.logger.debug('put items to table', {
        tableName,
        items,
        batchProcessOptions,
        outputs,
      });

      return outputs;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          tableName,
          items,
          batchProcessOptions,
        });

      throw error;
    }
  }

  /**
   * Deletes multiple items from a DynamoDB table in batches.
   *
   * @param tableName - Table name.
   * @param keys - Array of item keys.
   * @param batchProcessOptions - Batch process option overrides.
   *
   * @returns Array of {@link BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async deleteItems(
    tableName: string,
    keys: Item[],
    batchProcessOptions: EntityClientOptions['batchProcessOptions'] = {},
  ): Promise<BatchWriteCommandOutput[]> {
    // Validate options.
    if (!tableName) throw new Error('tableName is required');

    try {
      const batchHandler = async (batch: Item[]) =>
        await this.doc.batchWrite({
          RequestItems: {
            [tableName]: batch.map((key) => ({
              DeleteRequest: { Key: key },
            })),
          },
        });

      const unprocessedItemExtractor = (output: BatchWriteCommandOutput) =>
        output.UnprocessedItems?.[tableName];

      const outputs = await batchProcess(keys, {
        batchHandler,
        unprocessedItemExtractor,
        ...Object.assign(batchProcessOptions, this.batchProcessOptions),
      });

      this.logger.debug('deleted keys from table', {
        tableName,
        keys,
        batchProcessOptions,
        outputs,
      });

      return outputs;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          tableName,
          keys,
          batchProcessOptions,
        });

      throw error;
    }
  }

  /**
   * Purge all items from a DynamoDB table.
   *
   * @param tableName - Table name.
   * @param hashKey - Hash key name.
   * @param rangeKey - Range key name.
   * @param batchProcessOptions - Batch process option overrides.
   *
   * @returns Number of items purged.
   */
  async purgeItems(
    tableName: string,
    hashKey: string,
    rangeKey?: string,
    batchProcessOptions: EntityClientOptions['batchProcessOptions'] = {},
  ): Promise<number> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');
      if (!hashKey) throw new Error('hashKey is required');

      let purged = 0;
      let items: Item[] = [];
      let lastEvaluatedKey: Item | undefined = undefined;

      do {
        ({ Items: items = [], LastEvaluatedKey: lastEvaluatedKey } =
          await this.doc.scan({
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey,
          }));

        if (items.length) {
          const itemKeys = items.map((item) =>
            pick(item, sift([hashKey, rangeKey])),
          );

          await this.deleteItems(tableName, itemKeys, batchProcessOptions);

          purged += items.length;
        }
      } while (items.length);

      this.logger.debug('purged items from table', {
        tableName,
        hashKey,
        rangeKey,
        batchProcessOptions,
        purged,
      });

      return purged;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          tableName,
          hashKey,
          rangeKey,
          batchProcessOptions,
        });

      throw error;
    }
  }

  /**
   * Puts multiple items to a DynamoDB table as a single transaction.
   *
   * @param tableName - Table name.
   * @param items - Array of items.
   *
   * @returns `TransactWriteCommandOutput` object.
   */
  async transactPutItems(
    tableName: string,
    items: Item[],
  ): Promise<TransactWriteCommandOutput> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');

      const output = await this.doc.transactWrite({
        TransactItems: items.map((item) => ({
          Put: { Item: item, TableName: tableName },
        })),
      });

      this.logger.debug('put items to table as transaction', {
        tableName,
        items,
        output,
      });

      return output;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          tableName,
          items,
        });

      throw error;
    }
  }

  /**
   * Deletes multiple items from a DynamoDB table as a single transaction.
   *
   * @param tableName - Table name.
   * @param keys - Array of item keys.
   *
   * @returns `TransactWriteCommandOutput` object.
   */
  async transactDeleteItems(
    tableName: string,
    keys: Item[],
  ): Promise<TransactWriteCommandOutput> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');

      const transactWriteCommandOutput = await this.doc.transactWrite({
        TransactItems: keys.map((key) => ({
          Delete: { Key: key, TableName: tableName },
        })),
      });

      this.logger.debug('deleted items from table as transaction', {
        tableName,
        keys,
        transactWriteCommandOutput,
      });

      return transactWriteCommandOutput;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          tableName,
          keys,
        });

      throw error;
    }
  }

  /**
   * Get item from a DynamoDB table.
   *
   * @param tableName - Table name.
   * @param key - Item key.
   * @param options - {@link GetItemOptions | `GetItemOptions`} object.
   *
   * @returns `GetCommandOutput` object.
   *
   * @overload
   */
  async getItem(
    tableName: string,
    key: Item,
    options?: GetItemOptions,
  ): Promise<GetCommandOutput>;
  /**
   * Get item from a DynamoDB table.
   *
   * @param tableName - Table name.
   * @param key - Item key.
   * @param attributes - Item attributes to retrieve.
   * @param options - {@link GetItemOptions | `GetItemOptions`} object, omitting `attributes`.
   *
   * @returns `GetCommandOutput` object.
   *
   * @overload
   */
  async getItem(
    tableName: string,
    key: Item,
    attributes: string[],
    options?: Omit<GetItemOptions, 'attributes'>,
  ): Promise<GetCommandOutput>;
  async getItem(
    tableName: string,
    key: Item,
    attributesOrOptions?: string[] | GetItemOptions,
    remainingOptions?: Omit<GetItemOptions, 'attributes'>,
  ): Promise<GetCommandOutput> {
    // Resolve params.
    const attributes = isArray(attributesOrOptions)
      ? attributesOrOptions
      : attributesOrOptions?.attributes;

    const { consistentRead, returnConsumedCapacity } = isArray(
      attributesOrOptions,
    )
      ? (remainingOptions ?? {})
      : (attributesOrOptions ?? {});

    const attributeExpressions = attributes?.map((a) => `#${a}`);

    try {
      const getCommandOutput = await this.doc.get({
        ConsistentRead: consistentRead,
        Key: key,
        ReturnConsumedCapacity: returnConsumedCapacity,
        TableName: tableName,
        ...(attributes && attributeExpressions
          ? {
              ExpressionAttributeNames: zipToObject(
                attributeExpressions,
                attributes,
              ),
              ProjectionExpression: attributeExpressions.join(','),
            }
          : {}),
      });

      this.logger.debug('got item from table', {
        tableName,
        key,
        attributes,
        consistentRead,
        returnConsumedCapacity,
        getCommandOutput,
      });

      return getCommandOutput;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          tableName,
          key,
          attributes,
          consistentRead,
          returnConsumedCapacity,
        });

      throw error;
    }
  }

  /**
   * Gets multiple items from a DynamoDB table in batches.
   *
   * @param tableName - Table name.
   * @param keys - Array of item keys.
   * @param batchProcessOptions - Batch process option overrides.
   *
   * @returns An object containing a flattened array of returned items and the array of returned {@link BatchGetCommandOutput | `BatchGetCommandOutput`} objects.
   */
  async getItems(
    tableName: string,
    keys: Item[],
    batchProcessOptions: EntityClientOptions['batchProcessOptions'] = {},
  ): Promise<{ items: Item[]; outputs: BatchGetCommandOutput[] }> {
    // Validate options.
    if (!tableName) throw new Error('tableName is required');

    try {
      const batchHandler = async (batch: Item[]) =>
        await this.doc.batchGet({
          RequestItems: {
            [tableName]: {
              Keys: batch,
            },
          },
        });

      const unprocessedItemExtractor = (output: BatchGetCommandOutput) =>
        output.UnprocessedKeys?.[tableName]?.Keys;

      const outputs = await batchProcess(keys, {
        batchHandler,
        unprocessedItemExtractor,
        ...Object.assign(batchProcessOptions, this.batchProcessOptions),
      });

      this.logger.debug('got items from table', {
        tableName,
        keys,
        batchProcessOptions,
        outputs,
      });

      return {
        items: outputs.flatMap((output) => output.Responses?.[tableName] ?? []),
        outputs,
      };
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          tableName,
          keys,
          batchProcessOptions,
        });

      throw error;
    }
  }

  shardQueryMapBuilder<
    EntityToken extends keyof Exactify<M> & string,
    M extends EntityMap,
    HashKey extends string,
    RangeKey extends string,
    T extends TranscodeMap,
  >(
    tableName: string,
    entityManager: EntityManager<M, HashKey, RangeKey, T>,
    entityToken: EntityToken,
    hashKeyToken: PropertiesOfType<M[EntityToken], never> | HashKey,
    pageKey?: string,
  ) {
    return new ShardQueryMapBuilder(
      this,
      tableName,
      entityManager,
      entityToken,
      hashKeyToken,
      pageKey,
    );
  }
}
