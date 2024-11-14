import {
  CreateTableCommand,
  type CreateTableCommandInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type CreateTableCommandOutput, // imported to support API docs
  DeleteTableCommand,
  type DeleteTableCommandInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type DeleteTableCommandOutput, // imported to support API docs
  DynamoDBClient,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import {
  type BatchGetCommandOutput,
  type BatchWriteCommandOutput,
  type DeleteCommandInput,
  type DeleteCommandOutput,
  DynamoDBDocument,
  type GetCommandInput,
  type GetCommandOutput,
  type PutCommandInput,
  type PutCommandOutput,
  type TransactWriteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { batchProcess } from '@karmaniverous/batch-process';
import {
  type BaseConfigMap,
  BaseEntityClient,
  type EntityKey,
  type EntityRecord,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';
import AWSXray from 'aws-xray-sdk';
import { pick, zipToObject } from 'radash';

import type { BatchGetOptions } from './BatchGetOptions';
import type { BatchWriteOptions } from './BatchWriteOptions';
import type { EntityClientOptions } from './EntityClientOptions';
import type { WaiterConfig } from './WaiterConfig';

/**
 * Convenience wrapper around the AWS DynamoDB SDK in addition to {@link BaseEntityClient | `BaseEntityClient`} functionality.
 *
 * @remarks
 * This class provides a number of enhanced AWS DynamoDB SDK methods. For everything else, both the {@link DynamoDBClient | `DynamoDBClient`} and {@link DynamoDBDocument | `DynamoDBDocument`} instances are exposed for direct access on the {@link EntityClient.client | `client`} and {@link EntityClient.doc | `doc`} properties, respectively.
 *
 * For query operations, use the {@link QueryBuilder | `QueryBuilder`} class!
 *
 * @category EntityClient
 */
export class EntityClient<C extends BaseConfigMap> extends BaseEntityClient<C> {
  /** AWS SDK {@link DynamoDBClient | `DynamoDBClient`} instance. */
  readonly client: DynamoDBClient;

  /** AWS SDK {@link DynamoDBDocument | `DynamoDBDocument`} instance. */
  readonly doc: DynamoDBDocument;

  /** Table name. */
  readonly tableName: EntityClientOptions<C>['tableName'];

  /**
   * DynamoDB EntityClient constructor.
   *
   * @param options - {@link EntityClientOptions | `EntityClientOptions`} object.
   */
  constructor(options: EntityClientOptions<C>) {
    const {
      batchProcessOptions,
      enableXray = false,
      entityManager,
      logger,
      tableName,
      ...dynamoDbClientConfig
    } = options;

    super({ batchProcessOptions, entityManager, logger });

    const client = new DynamoDBClient(dynamoDbClientConfig);

    this.client =
      enableXray && process.env.AWS_XRAY_DAEMON_ADDRESS
        ? AWSXray.captureAWSv3Client(client)
        : client;

    this.doc = DynamoDBDocument.from(this.client, {
      marshallOptions: { removeUndefinedValues: true },
    });

    this.tableName = tableName;
  }

  /**
   * Creates a DynamoDB table using {@link CreateTableCommand | `CreateTableCommand`} and waits for the table to be created and available using {@link waitUntilTableExists | `waitUntilTableExists`}.
   *
   * @param options - {@link CreateTableCommandInput | `CreateTableCommandInput`} object. If `TableName` is provided it will override `this.tableName`.
   * @param waiterConfig - {@link WaiterConfig | `WaiterConfig`} with `maxWaitTime` defaulted to 60s.
   *
   * @returns An object containing the resulting {@link CreateTableCommandOutput | `CreateTableCommandOutput`} and {@link smithy!WaiterResult | `WaiterResult`} objects.
   */
  async createTable(
    options: MakeOptional<CreateTableCommandInput, 'TableName'>,
    waiterConfig: WaiterConfig = { maxWaitTime: 60 },
  ) {
    try {
      // Resolve options.
      const resolvedOptions: CreateTableCommandInput = {
        TableName: this.tableName,
        ...options,
      };

      // Send command.
      const createTableCommandOutput = await this.client.send(
        new CreateTableCommand(resolvedOptions),
      );

      if (!createTableCommandOutput.TableDescription?.TableStatus) {
        const msg = 'table creation request failed';
        this.logger.error(msg, createTableCommandOutput);
        throw new Error(msg);
      }

      // Await table creation.
      const waiterResult = await waitUntilTableExists(
        { client: this.client, ...waiterConfig },
        { TableName: resolvedOptions.TableName },
      );

      this.logger.debug('created table', {
        options,
        resolvedOptions,
        createTableCommandOutput,
        waiterResult,
      });

      return { createTableCommandOutput, waiterResult };
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, { options });

      throw error;
    }
  }

  /**
   * Deletes a DynamoDB table using {@link DeleteTableCommand | `DeleteTableCommand`} and waits for the table to be confirmed deleted with {@link waitUntilTableNotExists | `waitUntilTableNotExists`}.
   *
   * @param options - {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/Interface/DeleteTableCommandInput | `DeleteTableCommandInput`} object. If `TableName` is provided it will override `this.tableName`.
   * @param waiterConfig - {@link WaiterConfig | `WaiterConfig`} with `maxWaitTime` defaulted to 60s.
   *
   * @returns An object containing the resulting {@link DeleteTableCommandOutput | `DeleteTableCommandOutput`} and {@link smithy!WaiterResult | `WaiterResult`} objects.
   */
  async deleteTable(
    options: MakeOptional<DeleteTableCommandInput, 'TableName'> = {},
    waiterConfig: WaiterConfig = { maxWaitTime: 60 },
  ) {
    try {
      // Resolve options.
      const resolvedOptions = {
        TableName: this.tableName,
        ...options,
      } as CreateTableCommandInput;

      // Send command.
      const deleteTableCommandOutput = await this.client.send(
        new DeleteTableCommand(resolvedOptions),
      );

      if (!deleteTableCommandOutput.TableDescription?.TableStatus) {
        const msg = 'table deletion request failed';
        this.logger.error(msg, deleteTableCommandOutput);
        throw new Error(msg);
      }

      // Await table deletion.
      const waiterResult = await waitUntilTableNotExists(
        { client: this.client, ...waiterConfig },
        { TableName: resolvedOptions.TableName },
      );

      this.logger.debug('deleted table', {
        options,
        resolvedOptions,
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
   * @param item - {@link EntityRecord | `EntityRecord`} object.
   * @param options - {@link PutCommandInput | `PutCommandInput`} object with `Item` omitted and `TableName` optional. If provided, `TableName` will override `this.tableName`.
   *
   * @returns The resulting {@link PutCommandOutput | `PutCommandOutput`} object.
   *
   * @overload
   */
  async putItem(
    item: EntityRecord<C>,
    options?: MakeOptional<Omit<PutCommandInput, 'Item'>, 'TableName'>,
  ): Promise<PutCommandOutput>;
  /**
   * Puts an item to a DynamoDB table.
   *
   * @param options - {@link PutCommandInput | `PutCommandInput`} object with `TableName` optional. If provided, `TableName` will override `this.tableName`.
   *
   * @returns The resulting {@link PutCommandOutput | `PutCommandOutput`} object.
   *
   * @overload
   */
  async putItem(
    options: MakeOptional<
      ReplaceKey<PutCommandInput, 'Item', EntityRecord<C>>,
      'TableName'
    >,
  ): Promise<PutCommandOutput>;
  async putItem(
    itemOrOptions:
      | EntityRecord<C>
      | MakeOptional<
          ReplaceKey<PutCommandInput, 'Item', EntityRecord<C>>,
          'TableName'
        >,
    options: MakeOptional<Omit<PutCommandInput, 'Item'>, 'TableName'> = {},
  ): Promise<PutCommandOutput> {
    // Resolve options.
    const { hashKey, rangeKey } = this.entityManager.config;

    const resolvedOptions = {
      TableName: this.tableName,
      ...(hashKey in itemOrOptions && rangeKey in itemOrOptions
        ? {
            Item: itemOrOptions as EntityRecord<C>,
          }
        : itemOrOptions),
      ...options,
    } as ReplaceKey<PutCommandInput, 'Item', EntityRecord<C>>;

    try {
      // Send command.
      const response = await this.doc.put(resolvedOptions);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.logger.debug('put item to table', {
          itemOrOptions,
          options,
          resolvedOptions,
          response,
        });
      else {
        const msg = 'failed to put item to table';
        this.logger.error(msg, response);
        throw new Error(msg);
      }

      return response;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, { itemOrOptions, options });

      throw error;
    }
  }

  /**
   * Deletes an item from a DynamoDB table.
   *
   * @param key - {@link EntityKey | `EntityKey`} object.
   * @param options - {@link DeleteCommandInput | `DeleteCommandInput`} object with `Key` omitted and `TableName` optional. If provided, `TableName` will override `this.tableName`.
   *
   * @returns The resulting {@link DeleteCommandOutput | `DeleteCommandOutput`} object.
   *
   * @overload
   */
  async deleteItem(
    key: EntityKey<C>,
    options?: MakeOptional<Omit<DeleteCommandInput, 'Item'>, 'TableName'>,
  ): Promise<DeleteCommandOutput>;
  /**
   * Deletes an item to a DynamoDB table.
   *
   * @param options - {@link DeleteCommandInput | `DeleteCommandInput`} object with `TableName` optional. If provided, `TableName` will override `this.tableName`.
   *
   * @returns The resulting {@link DeleteCommandOutput | `DeleteCommandOutput`} object.
   *
   * @overload
   */
  async deleteItem(
    options: MakeOptional<
      ReplaceKey<DeleteCommandInput, 'Key', EntityKey<C>>,
      'TableName'
    >,
  ): Promise<DeleteCommandOutput>;
  async deleteItem(
    keyOrOptions:
      | EntityKey<C>
      | MakeOptional<
          ReplaceKey<DeleteCommandInput, 'Key', EntityKey<C>>,
          'TableName'
        >,
    options: MakeOptional<Omit<DeleteCommandInput, 'Key'>, 'TableName'> = {},
  ): Promise<DeleteCommandOutput> {
    // Resolve options.
    const { hashKey, rangeKey } = this.entityManager.config;

    const resolvedOptions = {
      TableName: this.tableName,
      ...(hashKey in keyOrOptions && rangeKey in keyOrOptions
        ? {
            Key: keyOrOptions as EntityRecord<C>,
          }
        : keyOrOptions),
      ...options,
    } as ReplaceKey<DeleteCommandInput, 'Key', EntityRecord<C>>;

    try {
      // Send command.
      const response = await this.doc.delete(resolvedOptions);

      // Evaluate response.
      if (response.$metadata.httpStatusCode === 200)
        this.logger.debug('deleted item from table', {
          keyOrOptions,
          options,
          resolvedOptions,
          response,
        });
      else {
        const msg = 'failed to delete item from table';
        this.logger.error(msg, response);
        throw new Error(msg);
      }

      return response;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, { keyOrOptions, options });

      throw error;
    }
  }

  /**
   * Puts multiple items to a DynamoDB table in batches.
   *
   * @param items - Array of {@link EntityRecord | `EntityRecord`} objects.
   * @param options - {@link BatchWriteOptions | `BatchWriteOptions`} object.
   *
   * @returns Array of {@link BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async putItems(
    items: EntityRecord<C>[],
    options: BatchWriteOptions = {},
  ): Promise<BatchWriteCommandOutput[]> {
    // Resolve options.
    const { tableName, batchProcessOptions, ...input }: BatchWriteOptions = {
      tableName: this.tableName,
      ...options,
    };

    try {
      const batchHandler = async (batch: EntityRecord<C>[]) =>
        await this.doc.batchWrite({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
          ...input,
        });

      const unprocessedItemExtractor = (output: BatchWriteCommandOutput) =>
        output.UnprocessedItems?.[tableName] as EntityRecord<C>[];

      const outputs = await batchProcess(items, {
        batchHandler,
        unprocessedItemExtractor,
        ...Object.assign({}, this.batchProcessOptions, batchProcessOptions),
      });

      this.logger.debug('put items to table', {
        items,
        options,
        tableName,
        batchProcessOptions,
        input,
        outputs,
      });

      return outputs;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, { items, options });

      throw error;
    }
  }

  /**
   * Deletes multiple items from a DynamoDB table in batches.
   *
   * @param keys - Array of {@link EntityKey | `EntityKey`} objects.
   * @param options - {@link BatchWriteOptions | `BatchWriteOptions`} object.
   *
   * @returns Array of {@link BatchWriteCommandOutput | `BatchWriteCommandOutput`} objects.
   */
  async deleteItems(
    keys: EntityKey<C>[],
    options: BatchWriteOptions = {},
  ): Promise<BatchWriteCommandOutput[]> {
    // Resolve options.
    const {
      tableName,
      batchProcessOptions,
      ...batchWritecommandInput
    }: BatchWriteOptions = {
      tableName: this.tableName,
      ...options,
    };

    try {
      const batchHandler = async (batch: EntityKey<C>[]) =>
        await this.doc.batchWrite({
          RequestItems: {
            [tableName]: batch.map((key) => ({
              DeleteRequest: { Key: key },
            })),
          },
          ...batchWritecommandInput,
        });

      const unprocessedItemExtractor = (output: BatchWriteCommandOutput) =>
        output.UnprocessedItems?.[tableName] as EntityKey<C>[];

      const outputs = await batchProcess(keys, {
        batchHandler,
        unprocessedItemExtractor,
        ...Object.assign({}, this.batchProcessOptions, batchProcessOptions),
      });

      this.logger.debug('deleted keys from table', {
        keys,
        options,
        tableName,
        batchProcessOptions,
        batchWritecommandInput,
        outputs,
      });

      return outputs;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, { keys, options });

      throw error;
    }
  }

  /**
   * Purge all items from a DynamoDB table.
   *
   * @param options - {@link BatchWriteOptions | `BatchWriteOptions`} object.
   *
   * @returns Number of items purged.
   */
  async purgeItems(options: BatchWriteOptions = {}): Promise<number> {
    try {
      // Resolve options.
      const { tableName, ...batchWriteOptions }: BatchWriteOptions = {
        tableName: this.tableName,
        ...options,
      };

      let purged = 0;
      let items: Record<string, unknown>[] = [];
      let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
      const { hashKey, rangeKey } = this.entityManager.config;

      do {
        ({ Items: items = [], LastEvaluatedKey: lastEvaluatedKey } =
          await this.doc.scan({
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey,
          }));

        if (items.length) {
          const itemKeys = items.map((item) =>
            pick(item, [hashKey, rangeKey]),
          ) as EntityKey<C>[];

          await this.deleteItems(itemKeys, {
            tableName,
            ...batchWriteOptions,
          });

          purged += items.length;
        }
      } while (items.length);

      this.logger.debug('purged items from table', {
        options,
        tableName,
        batchWriteOptions,
        purged,
      });

      return purged;
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, { options });

      throw error;
    }
  }

  /**
   * Puts multiple items to a DynamoDB table as a single transaction.
   *
   * @param items - Array of {@link EntityRecord | `EntityRecord`} objects.
   *
   * @returns `TransactWriteCommandOutput` object.
   */
  async transactPutItems(
    items: EntityRecord<C>[],
  ): Promise<TransactWriteCommandOutput> {
    try {
      const output = await this.doc.transactWrite({
        TransactItems: items.map((item) => ({
          Put: { Item: item, TableName: this.tableName },
        })),
      });

      this.logger.debug('put items to table as transaction', { items, output });

      return output;
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, { items });

      throw error;
    }
  }

  /**
   * Deletes multiple items from a DynamoDB table as a single transaction.
   *
   * @param keys - Array of {@link EntityKey | `EntityKey`} objects.
   *
   * @returns `TransactWriteCommandOutput` object.
   */
  async transactDeleteItems(
    keys: EntityKey<C>[],
  ): Promise<TransactWriteCommandOutput> {
    try {
      const output = await this.doc.transactWrite({
        TransactItems: keys.map((key) => ({
          Delete: { Key: key, TableName: this.tableName },
        })),
      });

      this.logger.debug('deleted items from table as transaction', {
        keys,
        output,
      });

      return output;
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, { keys });

      throw error;
    }
  }

  /**
   * Get item from a DynamoDB table.
   *
   * @param key - {@link EntityKey | `EntityKey`} object.
   * @param attributes - Item attributes to retrieve.
   * @param options - {@link GetCommandInput | `GetCommandInput`} object with `Key` & projection-related properties omitted and `TableName` optional. If provided, `TableName` will override `this.tableName`.
   *
   * @returns `GetCommandOutput` object, where the `Item` key is replaced by an {@link EntityRecord | `EntityRecord`}.
   *
   * @overload
   */
  async getItem(
    key: EntityKey<C>,
    attributes: string[],
    options?: MakeOptional<
      Omit<
        GetCommandInput,
        | 'AttributesToGet'
        | 'ExpressionAttributeNames'
        | 'Key'
        | 'ProjectionExpression'
      >,
      'TableName'
    >,
  ): Promise<ReplaceKey<GetCommandOutput, 'Item', EntityRecord<C> | undefined>>;
  /**
   * Get item from a DynamoDB table.
   *
   * @param key - {@link EntityKey | `EntityKey`} object.
   * @param options - {@link GetCommandInput | `GetCommandInput`} object with `Key` omitted and `TableName` optional. If provided, `TableName` will override `this.tableName`.
   *
   * @returns `GetCommandOutput` object, where the `Item` key is replaced by an {@link EntityRecord | `EntityRecord`}.
   *
   * @overload
   */
  async getItem(
    key: EntityKey<C>,
    options?: MakeOptional<Omit<GetCommandInput, 'Key'>, 'TableName'>,
  ): Promise<ReplaceKey<GetCommandOutput, 'Item', EntityRecord<C> | undefined>>;
  /**
   * Get item from a DynamoDB table.
   *
   * @param options - {@link GetCommandInput | `GetCommandInput`} object with `TableName` optional. If provided, `TableName` will override `this.tableName`.
   *
   * @returns `GetCommandOutput` object, where the `Item` key is replaced by an {@link EntityRecord | `EntityRecord`}.
   *
   * @overload
   */
  async getItem(
    options: MakeOptional<GetCommandInput, 'TableName'>,
  ): Promise<ReplaceKey<GetCommandOutput, 'Item', EntityRecord<C> | undefined>>;
  async getItem(
    keyOrOptions: EntityKey<C> | MakeOptional<GetCommandInput, 'TableName'>,
    attributesOrOptions?:
      | string[]
      | MakeOptional<Omit<GetCommandInput, 'Key'>, 'TableName'>,
    options?: MakeOptional<
      Omit<
        GetCommandInput,
        | 'AttributesToGet'
        | 'ExpressionAttributeNames'
        | 'Key'
        | 'ProjectionExpression'
      >,
      'TableName'
    >,
  ): Promise<
    ReplaceKey<GetCommandOutput, 'Item', EntityRecord<C> | undefined>
  > {
    // Resolve options.
    const { hashKey, rangeKey } = this.entityManager.config;

    const { AttributesToGet: attributes, ...resolvedOptions } = {
      TableName: this.tableName,
      ...(hashKey in keyOrOptions && rangeKey in keyOrOptions
        ? { Key: keyOrOptions as EntityKey<C> }
        : keyOrOptions),
      ...(Array.isArray(attributesOrOptions)
        ? { AttributesToGet: attributesOrOptions }
        : attributesOrOptions),
      ...options,
    } as ReplaceKey<GetCommandInput, 'Key', EntityKey<C>>;

    const attributeExpressions = attributes?.map((a) => `#${a.toString()}`);

    const input: ReplaceKey<GetCommandInput, 'Key', EntityKey<C>> = {
      ...(attributes && attributeExpressions
        ? {
            ExpressionAttributeNames: zipToObject(
              attributeExpressions,
              attributes,
            ),
            ProjectionExpression: attributeExpressions.join(','),
          }
        : {}),
      ...resolvedOptions,
    };

    try {
      const output = (await this.doc.get(input)) as ReplaceKey<
        GetCommandOutput,
        'Item',
        EntityRecord<C> | undefined
      >;

      this.logger.debug('got item from table', {
        keyOrOptions,
        attributesOrOptions,
        options,
        attributes,
        resolvedOptions,
        attributeExpressions,
        input,
        output,
      });

      return output;
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, {
          keyOrOptions,
          attributesOrOptions,
          options,
        });

      throw error;
    }
  }

  /**
   * Gets multiple items from a DynamoDB table in batches.
   *
   * @param keys - Array of {@link EntityKey | `EntityKey`} objects.
   * @param options - {@link BatchGetOptions | `BatchGetOptions`} object.
   *
   * @returns An object containing a flattened array of returned items and the array of returned {@link BatchGetCommandOutput | `BatchGetCommandOutput`} objects.
   */
  async getItems(
    keys: EntityKey<C>[],
    options: BatchGetOptions = {},
  ): Promise<{ items: EntityRecord<C>[]; outputs: BatchGetCommandOutput[] }> {
    // Resolve options.
    const { tableName, batchProcessOptions, ...input }: BatchGetOptions = {
      tableName: this.tableName,
      ...options,
    };

    try {
      const batchHandler = async (batch: EntityKey<C>[]) =>
        await this.doc.batchGet({
          RequestItems: {
            [tableName]: {
              Keys: batch,
            },
          },
          ...input,
        });

      const unprocessedItemExtractor = (output: BatchGetCommandOutput) =>
        output.UnprocessedKeys?.[tableName]?.Keys as EntityKey<C>[];

      const outputs = await batchProcess(keys, {
        batchHandler,
        unprocessedItemExtractor,
        ...Object.assign({}, this.batchProcessOptions, batchProcessOptions),
      });

      this.logger.debug('got items from table', {
        keys,
        options,
        tableName,
        batchProcessOptions,
        input,
        outputs,
      });

      return {
        items: outputs.flatMap(
          (output) => output.Responses?.[tableName] ?? [],
        ) as EntityRecord<C>[],
        outputs,
      };
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(error.message, { keys, options });

      throw error;
    }
  }
}
