import {
  CreateTableCommand,
  type CreateTableCommandInput,
  DeleteTableCommand,
  type DeleteTableCommandInput,
  DynamoDBClient,
  type DynamoDBClientConfig as SdkDynamoDbClientConfig,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import {
  type BatchWriteCommandOutput,
  type DeleteCommandInput,
  type DeleteCommandOutput,
  DynamoDBDocument,
  type GetCommandInput,
  type GetCommandOutput,
  type NativeAttributeValue,
  type PutCommandInput,
  type PutCommandOutput,
  TransactWriteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import AWSXray from 'aws-xray-sdk';
import {
  cluster,
  isArray,
  isFunction,
  isString,
  parallel,
  pick,
  sift,
  zipToObject,
} from 'radash';
import { setTimeout } from 'timers/promises';

import type { WithRequiredAndNonNullable } from './WithRequiredAndNonNullable';

export type LoggerEndpoint = (...args: unknown[]) => void;

export interface Logger {
  debug: LoggerEndpoint;
  error: LoggerEndpoint;
}

const conditionalizeLoggerEndpoint =
  (fn: LoggerEndpoint, condition: boolean): LoggerEndpoint =>
  (...args: unknown[]) => {
    if (condition) fn(...args);
  };

/**
 * Configurations specific to the Entity Manager DynamoDBClient.
 */
export interface EntityManagerDynamoDbClientConfig {
  /** Default batch size for batched operations. Defaults to `25`. */
  defaultBatchSize?: number;

  /** Default delay increment in ms for retry operations. Defaults to `100` and is doubled on each retry. */
  defaultDelayIncrement?: number;

  /** Default max retries for retry operations. Defaults to `5`. */
  defaultMaxRetries?: number;

  /** Default throttle for parallel operations. Defaults to `10`. */
  defaultThrottle?: number;

  /** Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment. */
  enableXray?: boolean;

  /** Logger to use for internal logging. Must support the `debug` & `error` methods. Defaults to `console`. */
  logger?: Logger;

  /** Enables internal logging when `true`. */
  logInternals?: boolean;
}

/**
 * Entity Manager DynamoDBClient configuration.
 */
export type DynamoDbClientConfig = SdkDynamoDbClientConfig &
  EntityManagerDynamoDbClientConfig;

/**
 * Options for methods that support batch operations.
 */
export interface BatchOptions {
  /** Batch size. Defaults to {@link EntityManagerDynamoDbClientConfig.defaultBatchSize | `EntityManagerDynamoDbClientConfig.defaultBatchSize`}. */
  batchSize?: number;

  /** Delay increment in ms for retry operations. Defaults to {@link EntityManagerDynamoDbClientConfig.defaultDelayIncrement | `EntityManagerDynamoDbClientConfig.defaultDelayIncrement`} and is doubled on each retry. */
  delayIncrement?: number;

  /** Max retries for retry operations. Defaults to {@link EntityManagerDynamoDbClientConfig.defaultMaxRetries | `EntityManagerDynamoDbClientConfig.defaultMaxRetries`}. */
  maxRetries?: number;

  /** Throttle for parallel operations. Defaults to {@link EntityManagerDynamoDbClientConfig.defaultThrottle | `EntityManagerDynamoDbClientConfig.defaultThrottle`}. */
  throttle?: number;
}

/**
 * Options for {@link DynamoDbClient.getItem | `DynamoDbClient.getItem`} method.
 *
 * @typeParam T - Item type.
 */
export interface GetItemOptions {
  /** Item attributes to retrieve (undefined retrieves all attributes). */
  attributes?: string[];

  /** Determines the read consistency model: If set to `true`, then the operation uses strongly consistent reads; otherwise, the operation uses eventually consistent reads. */
  consistentRead?: GetCommandInput['ConsistentRead'];

  /**
   * <p>Determines the level of detail about either provisioned or on-demand throughput
   *             consumption that is returned in the response:</p>
   *          <ul>
   *             <li>
   *                <p>
   *                   <code>INDEXES</code> - The response includes the aggregate
   *                         <code>ConsumedCapacity</code> for the operation, together with
   *                         <code>ConsumedCapacity</code> for each table and secondary index that was
   *                     accessed.</p>
   *                <p>Note that some operations, such as <code>GetItem</code> and
   *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
   *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
   *                     information for table(s).</p>
   *             </li>
   *             <li>
   *                <p>
   *                   <code>TOTAL</code> - The response includes only the aggregate
   *                         <code>ConsumedCapacity</code> for the operation.</p>
   *             </li>
   *             <li>
   *                <p>
   *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
   *                     response.</p>
   *             </li>
   *          </ul>
   */
  returnConsumedCapacity?: GetCommandInput['ReturnConsumedCapacity'];
}

/**
 * A convenience wrapper around the AWS SDK DynamoDBClient and DynamoDBDocument classes. Provides special support for marshaling query constraints & generating Entity Manager ShardQueryFunction.
 */
export class DynamoDbClient {
  #client: DynamoDBClient;
  #config: SdkDynamoDbClientConfig &
    Required<EntityManagerDynamoDbClientConfig>;
  #doc: DynamoDBDocument;

  constructor({
    defaultBatchSize = 25,
    defaultDelayIncrement = 100,
    defaultMaxRetries = 5,
    defaultThrottle = 10,
    enableXray = false,
    logger = console,
    logInternals = false,
    ...sdkConfig
  }: DynamoDbClientConfig = {}) {
    if (!isFunction(logger.debug))
      throw new Error('logger must support debug method');
    if (!isFunction(logger.error))
      throw new Error('logger must support error method');

    this.#config = {
      defaultBatchSize,
      defaultDelayIncrement,
      defaultMaxRetries,
      defaultThrottle,
      enableXray,
      logger: {
        ...logger,
        debug: conditionalizeLoggerEndpoint(logger.debug, logInternals),
      },
      logInternals,
      ...sdkConfig,
    };

    const client = new DynamoDBClient(sdkConfig);

    this.#client =
      enableXray && process.env.AWS_XRAY_DAEMON_ADDRESS
        ? AWSXray.captureAWSv3Client(client)
        : client;

    this.#doc = DynamoDBDocument.from(this.#client, {
      marshallOptions: { removeUndefinedValues: true },
    });
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
   * Returns the configuration used to create the DynamoDbClient instance.
   */
  get config() {
    return this.#config;
  }

  /**
   * Creates a DynamoDB table using {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/CreateTableCommand | `CreateTableCommand`} and waits for the table to be created and available using {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Variable/waitUntilTableExists/ | `waitUntilTableExists`}.
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/CreateTableCommandInput | `CreateTableCommandInput`} object with the `TableName` property required and non-nullable.
   * @param waiterConfig - {@link https://github.com/smithy-lang/smithy-typescript/blob/main/packages/types/src/waiter.ts | `WaiterConfiguration`} with `client` parameter omitted & `maxWaitTime` defaulted to 60s.
   * @returns An object containing the resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/CreateTableCommandOutput | `CreateTableCommandOutput`} and {@link https://github.com/smithy-lang/smithy-typescript/blob/main/packages/util-waiter/src/waiter.ts#L36-L43 | `WaiterResult`} objects.
   */
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
        this.config.logger.error(msg, createTableCommandOutput);
        throw new Error(msg);
      }

      // Await table creation.
      const waiterResult = await waitUntilTableExists(
        { client: this.client, ...waiterConfig },
        { TableName: options.TableName },
      );

      this.config.logger.debug('created table', {
        options,
        createTableCommandOutput,
        waiterResult,
      });

      return { createTableCommandOutput, waiterResult };
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, { options });

      throw error;
    }
  }

  /**
   * Deletes a DynamoDB table using {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/DeleteTableCommand/ | `DeleteTableCommand`} and waits for the table to be confirmed deleted with {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Variable/waitUntilTableNotExists/ | `waitUntilTableNotExists`}.
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/DeleteTableCommandInput | `DeleteTableCommandInput`} object with the `TableName` property required and non-nullable.
   * @param waiterConfig - {@link https://github.com/smithy-lang/smithy-typescript/blob/main/packages/types/src/waiter.ts | `WaiterConfiguration`} with `client` parameter omitted & `maxWaitTime` defaulted to 60s.
   * @returns An object containing the resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/DeleteTableCommandOutput | `DeleteTableCommandOutput`} and {@link https://github.com/smithy-lang/smithy-typescript/blob/main/packages/util-waiter/src/waiter.ts#L36-L43 | `WaiterResult`} objects.
   */
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
        this.config.logger.error(msg, deleteTableCommandOutput);
        throw new Error(msg);
      }

      // Await table deletion.
      const waiterResult = await waitUntilTableNotExists(
        { client: this.client, ...waiterConfig },
        { TableName: options.TableName },
      );

      this.config.logger.debug('deleted table', {
        options,
        deleteTableCommandOutput,
        waiterResult,
      });

      return { deleteTableCommandOutput, waiterResult };
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, { options });

      throw error;
    }
  }

  /**
   * Puts an item to a DynamoDB table.
   * @param tableName - Table name.
   * @param item - Item.
   * @returns The resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/PutCommandOutput | `PutCommandOutput`} object.
   * @overload
   */
  /**
   * Puts an item to a DynamoDB table.
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/PutCommandInput | `PutCommandInput`} object with the `Item` & `TableName` properties required and non-nullable.
   * @returns The resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/PutCommandOutput | `PutCommandOutput`} object.
   * @overload
   */
  async putItem(
    options: WithRequiredAndNonNullable<PutCommandInput, 'Item' | 'TableName'>,
  ): Promise<PutCommandOutput>;
  async putItem(
    tableName: string,
    item: Record<string, NativeAttributeValue>,
  ): Promise<PutCommandOutput>;
  async putItem(
    optionsOrTableName:
      | WithRequiredAndNonNullable<PutCommandInput, 'Item' | 'TableName'>
      | string,
    item?: Record<string, NativeAttributeValue>,
  ): Promise<PutCommandOutput> {
    try {
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
        if (!optionsOrTableName.Item)
          throw new Error('options.Item is required');
        if (!optionsOrTableName.TableName)
          throw new Error('options.TableName is required');

        options = optionsOrTableName;
      }

      // Send command.
      const response = await this.#doc.put(options);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.config.logger.debug('put item to table', {
          optionsOrTableName,
          item,
          response,
        });
      else {
        const msg = 'failed to put item to table';
        this.config.logger.error(msg, response);
        throw new Error(msg);
      }

      return response;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, { optionsOrTableName, item });

      throw error;
    }
  }

  /**
   * Deletes an item from a DynamoDB table.
   * @param tableName - Table name.
   * @param key - Item key.
   * @returns The resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/DeleteCommandOutput | `DeleteCommandOutput`} object.
   * @overload
   */
  async deleteItem(
    tableName: string,
    key: Record<string, NativeAttributeValue>,
  ): Promise<DeleteCommandOutput>;
  /**
   * Deletes an item from a DynamoDB table.
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/DeleteCommandInput | `DeleteCommandInput`} object with the `Key` & `TableName` properties required and non-nullable.
   * @returns The resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/DeleteCommandOutput | `DeleteCommandOutput`} object.
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
    key?: Record<string, NativeAttributeValue>,
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
      const response = await this.#doc.delete(options);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.config.logger.debug('deleted item from table', {
          optionsOrTableName,
          key,
          response,
        });
      else {
        const msg = 'failed to delete item from table';
        this.config.logger.error(msg, response);
        throw new Error(msg);
      }

      return response;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, { optionsOrTableName, key });

      throw error;
    }
  }

  /**
   * Puts multiple items to a DynamoDB table in batches.
   *
   * @param tableName - Table name.
   * @param items - Array of items.
   * @param batchOptions - {@link BatchOptions | `BatchOptions`} object.
   * @returns Array of {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async putItems(
    tableName: string,
    items: Record<string, NativeAttributeValue>[],
    {
      batchSize = this.config.defaultBatchSize,
      delayIncrement = this.config.defaultDelayIncrement,
      maxRetries = this.config.defaultMaxRetries,
      throttle = this.config.defaultThrottle,
    }: BatchOptions = {},
  ): Promise<BatchWriteCommandOutput[]> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');

      const batches = cluster(items, batchSize);
      const batchWriteCommandOutputs: BatchWriteCommandOutput[] = [];

      await parallel(throttle, batches, async (batch) => {
        let delay = 0;
        let retry = 0;

        while (batch.length) {
          if (delay) await setTimeout(delay);

          const batchWriteCommandOutput = await this.#doc.batchWrite({
            RequestItems: {
              [tableName]: batch.map((item) => ({
                PutRequest: { Item: item },
              })),
            },
          });

          this.config.logger.debug('put item batch to table', {
            batch,
            delay,
            retry,
            batchWriteCommandOutput,
          });

          batchWriteCommandOutputs.push(batchWriteCommandOutput);

          batch = batchWriteCommandOutput.UnprocessedItems?.[tableName] ?? [];

          if (batch.length) {
            if (retry === maxRetries) throw new Error('max retries exceeded');

            delay = delay ? delay * 2 : delayIncrement;
            retry++;
          }
        }
      });

      this.config.logger.debug('put items to table', {
        tableName,
        items,
        batchOptions: { batchSize, delayIncrement, maxRetries, throttle },
        batchWriteCommandOutputs,
      });

      return batchWriteCommandOutputs;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, {
          tableName,
          items,
          batchOptions: { batchSize, delayIncrement, maxRetries, throttle },
        });

      throw error;
    }
  }

  /**
   * Deletes multiple items from a DynamoDB table in batches.
   *
   * @param tableName - Table name.
   * @param keys - Array of item keys.
   * @param batchOptions - {@link BatchOptions | `BatchOptions`} object.
   * @returns Array of {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async deleteItems(
    tableName: string,
    keys: Record<string, NativeAttributeValue>[],
    {
      batchSize = this.config.defaultBatchSize,
      delayIncrement = this.config.defaultDelayIncrement,
      maxRetries = this.config.defaultMaxRetries,
      throttle = this.config.defaultThrottle,
    }: BatchOptions = {},
  ): Promise<BatchWriteCommandOutput[]> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');

      const batches = cluster(keys, batchSize);
      const batchWriteCommandOutputs: BatchWriteCommandOutput[] = [];

      await parallel(throttle, batches, async (batch) => {
        let delay = 0;
        let retry = 0;

        while (batch.length) {
          if (delay) await setTimeout(delay);

          const batchWriteCommandOutput = await this.#doc.batchWrite({
            RequestItems: {
              [tableName]: batch.map((key) => ({
                DeleteRequest: { Key: key },
              })),
            },
          });

          this.config.logger.debug('deleted key batch from table', {
            batch,
            delay,
            retry,
            batchWriteCommandOutput,
          });

          batchWriteCommandOutputs.push(batchWriteCommandOutput);

          batch = batchWriteCommandOutput.UnprocessedItems?.[tableName] ?? [];

          if (batch.length) {
            if (retry === maxRetries) throw new Error('max retries exceeded');

            delay = delay ? delay * 2 : delayIncrement;
            retry++;
          }
        }
      });

      this.config.logger.debug('deleted keys from table', {
        tableName,
        keys,
        batchOptions: { batchSize, delayIncrement, maxRetries, throttle },
        batchWriteCommandOutputs,
      });

      return batchWriteCommandOutputs;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, {
          tableName,
          keys,
          batchOptions: { batchSize, delayIncrement, maxRetries, throttle },
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
   * @param batchOptions - {@link BatchOptions | `BatchOptions`} object.
   * @returns Number of items purged.
   */
  async purgeItems(
    tableName: string,
    hashKey: string,
    rangeKey?: string,
    batchOptions: BatchOptions = {},
  ): Promise<number> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');
      if (!hashKey) throw new Error('hashKey is required');

      let purged = 0;
      let items: Record<string, NativeAttributeValue>[] = [];
      let lastEvaluatedKey: Record<string, NativeAttributeValue> | undefined =
        undefined;

      do {
        ({ Items: items = [], LastEvaluatedKey: lastEvaluatedKey } =
          await this.#doc.scan({
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey,
          }));

        if (items.length) {
          const itemKeys = items.map((item) =>
            pick(item, sift([hashKey, rangeKey])),
          );

          await this.deleteItems(tableName, itemKeys, batchOptions);

          purged += items.length;
        }
      } while (items.length);

      this.config.logger.debug('purged items from table', {
        tableName,
        hashKey,
        rangeKey,
        batchOptions,
        purged,
      });

      return purged;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, {
          tableName,
          hashKey,
          rangeKey,
          batchOptions,
        });

      throw error;
    }
  }

  /**
   * Puts multiple items to a DynamoDB table as a single transaction.
   *
   * @param tableName - Table name.
   * @param items - Array of items.
   * @returns {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/TransactWriteItemsCommandOutput | `TransactWriteCommandOutput`} object.
   */
  async transactPutItems(
    tableName: string,
    items: Record<string, NativeAttributeValue>[],
  ): Promise<TransactWriteCommandOutput> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');

      const transactWriteCommandOutput = await this.doc.transactWrite({
        TransactItems: items.map((item) => ({
          Put: { Item: item, TableName: tableName },
        })),
      });

      this.config.logger.debug('put items to table as transaction', {
        tableName,
        items,
        transactWriteCommandOutput,
      });

      return transactWriteCommandOutput;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, {
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
   * @returns {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/TransactWriteItemsCommandOutput | `TransactWriteCommandOutput`} object.
   */
  async transactDeleteItems(
    tableName: string,
    keys: Record<string, NativeAttributeValue>[],
  ): Promise<TransactWriteCommandOutput> {
    try {
      // Validate options.
      if (!tableName) throw new Error('tableName is required');

      const transactWriteCommandOutput = await this.doc.transactWrite({
        TransactItems: keys.map((key) => ({
          Delete: { Key: key, TableName: tableName },
        })),
      });

      this.config.logger.debug('deleted items from table as transaction', {
        tableName,
        keys,
        transactWriteCommandOutput,
      });

      return transactWriteCommandOutput;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, {
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
   * @param key - Item keys.
   * @param options - {@link GetItemOptions | `GetItemOptions`} object.
   *
   * @returns {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/GetCommandOutput/ | GetCommandOutput`} object.
   */
  async getItem(
    tableName: string,
    key: Record<string, NativeAttributeValue>,
    options?: GetItemOptions,
  ): Promise<GetCommandOutput>;
  /**
   * Get item from a DynamoDB table.
   *
   * @param tableName - Table name.
   * @param key - Item keys.
   * @param attributes - Item attributes to retrieve.
   * @param options - {@link GetItemOptions | `GetItemOptions`} object, omitting `attributes`.
   *
   * @returns {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/GetCommandOutput/ | GetCommandOutput`} object.
   */
  async getItem(
    tableName: string,
    key: Record<string, NativeAttributeValue>,
    attributes: string[],
    options?: Omit<GetItemOptions, 'attributes'>,
  ): Promise<GetCommandOutput>;
  async getItem(
    tableName: string,
    key: Record<string, NativeAttributeValue>,
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

      this.config.logger.debug('got item from table', {
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
        this.config.logger.error(error.message, {
          tableName,
          key,
          attributes,
          consistentRead,
          returnConsumedCapacity,
        });

      throw error;
    }
  }
}
