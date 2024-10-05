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
  BatchWriteCommandOutput,
  DeleteCommandInput,
  DynamoDBDocument,
  NativeAttributeValue,
  PutCommandInput,
} from '@aws-sdk/lib-dynamodb';
import AWSXray from 'aws-xray-sdk';
import { cluster, isFunction, parallel } from 'radash';
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
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/PutCommandInput | `PutCommandInput`} object with the `Item` & `TableName` properties required and non-nullable.
   * @returns The resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/PutCommandOutput | `PutCommandOutput`} object.
   */
  async putItem(
    options: WithRequiredAndNonNullable<PutCommandInput, 'Item' | 'TableName'>,
  ) {
    try {
      // Validate options.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!options.Item) throw new Error('Item is required');
      if (!options.TableName) throw new Error('TableName is required');

      // Send command.
      const response = await this.#doc.put(options);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.config.logger.debug('put item to table', { options, response });
      else {
        const msg = 'failed to put item to table';
        this.config.logger.error(msg, response);
        throw new Error(msg);
      }

      return response;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, { options });

      throw error;
    }
  }

  /**
   * Deletes an item from a DynamoDB table.
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/DeleteCommandInput | `DeleteCommandInput`} object with the `Key` & `TableName` properties required and non-nullable.
   * @returns The resulting {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/DeleteCommandOutput | `DeleteCommandOutput`} object.
   */
  async deleteItem(
    options: WithRequiredAndNonNullable<
      DeleteCommandInput,
      'Key' | 'TableName'
    >,
  ) {
    try {
      // Validate options.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!options.Key) throw new Error('Key is required');
      if (!options.TableName) throw new Error('TableName is required');

      // Send command.
      const response = await this.#doc.delete(options);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.config.logger.debug('deleted item from table', {
          options,
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
        this.config.logger.error(error.message, { options });

      throw error;
    }
  }

  /**
   * Puts multiple items to a DynamoDB table in batches.
   *
   * @param options - Options object.
   * @returns Array of {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async putItems({
    batchSize = this.config.defaultBatchSize,
    delayIncrement = this.config.defaultDelayIncrement,
    items,
    maxRetries = this.config.defaultMaxRetries,
    tableName,
    throttle = this.config.defaultThrottle,
  }: {
    /** Array of items. */
    items: Record<string, NativeAttributeValue>[];

    /** Table name. */
    tableName: string;
  } & BatchOptions) {
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
        batchSize,
        delayIncrement,
        items,
        maxRetries,
        tableName,
        throttle,
        batchWriteCommandOutputs,
      });

      return batchWriteCommandOutputs;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, {
          batchSize,
          delayIncrement,
          items,
          maxRetries,
          tableName,
          throttle,
        });

      throw error;
    }
  }

  /**
   * Deletes multiple items from a DynamoDB table in batches.
   *
   * @param options - Options object.
   * @returns Array of {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/TypeAlias/BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async deleteItems({
    batchSize = this.config.defaultBatchSize,
    delayIncrement = this.config.defaultDelayIncrement,
    keys,
    maxRetries = this.config.defaultMaxRetries,
    tableName,
    throttle = this.config.defaultThrottle,
  }: {
    /** Array of items (only primary key values are required). */
    keys: Record<string, NativeAttributeValue>[];

    /** Table name. */
    tableName: string;
  } & BatchOptions) {
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
        batchSize,
        delayIncrement,
        keys,
        maxRetries,
        tableName,
        throttle,
        batchWriteCommandOutputs,
      });

      return batchWriteCommandOutputs;
    } catch (error) {
      if (error instanceof Error)
        this.config.logger.error(error.message, {
          batchSize,
          delayIncrement,
          keys,
          maxRetries,
          tableName,
          throttle,
        });

      throw error;
    }
  }
}
