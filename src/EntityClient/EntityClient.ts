import {
  type CreateTableCommandInput,
  type DeleteTableCommandInput,
  DynamoDBClient,
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
import {
  type BaseConfigMap,
  BaseEntityClient,
  type EntityKey,
  type EntityManager,
  type EntityRecord,
  type EntityRecordByToken,
  type EntityToken,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';
import AWSXray from 'aws-xray-sdk';

import type { BatchGetOptions } from './BatchGetOptions';
import type { BatchWriteOptions } from './BatchWriteOptions';
import type { EntityClientOptions } from './EntityClientOptions';
// Delegated method helpers.
import { createTable as createTableFn } from './methods/createTable';
import { deleteItem as deleteItemFn } from './methods/deleteItem';
import { deleteItems as deleteItemsFn } from './methods/deleteItems';
import { deleteTable as deleteTableFn } from './methods/deleteTable';
import { getItem as getItemFn } from './methods/getItem';
import { getItems as getItemsFn } from './methods/getItems';
import { purgeItems as purgeItemsFn } from './methods/purgeItems';
import { putItem as putItemFn } from './methods/putItem';
import { putItems as putItemsFn } from './methods/putItems';
import { transactDeleteItems as transactDeleteItemsFn } from './methods/transactDeleteItems';
import { transactPutItems as transactPutItemsFn } from './methods/transactPutItems';
import type { WaiterConfig } from './WaiterConfig';

// Local type helper for tuple-based projection narrowing
export type Projected<T, A extends readonly string[]> = Pick<
  T,
  Extract<A[number], keyof T>
>;

/**
 * Convenience wrapper around the AWS DynamoDB SDK in addition to
 * {@link BaseEntityClient | BaseEntityClient} functionality.
 *
 * This class exposes {@link client | DynamoDBClient} and {@link doc | DynamoDBDocument}
 * for direct access, and delegates high-level operations to small helper modules.
 *
 * For query operations, use the {@link QueryBuilder | QueryBuilder} class.
 *
 * @category EntityClient
 */
export class EntityClient<
  C extends BaseConfigMap,
  CF = unknown,
> extends BaseEntityClient<C> {
  /** AWS SDK DynamoDBClient instance. */
  readonly client: DynamoDBClient;

  /** AWS SDK DynamoDBDocument instance. */
  readonly doc: DynamoDBDocument;

  /** Table name. */
  readonly tableName: EntityClientOptions<C>['tableName'];

  /**
   * DynamoDB EntityClient constructor.
   *
   * @param options - {@link EntityClientOptions | EntityClientOptions} object.
   */
  constructor(
    options: EntityClientOptions<C> & {
      entityManager: EntityManager<C, CF>;
    },
  ) {
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
   * Creates a DynamoDB table and waits for it to become active.
   *
   * @param options - CreateTableCommandInput; TableName defaults to this.tableName.
   * @param waiterConfig - Waiter configuration (default maxWaitTime 60s).
   */
  async createTable(
    options: MakeOptional<CreateTableCommandInput, 'TableName'>,
    waiterConfig: WaiterConfig = { maxWaitTime: 60 },
  ) {
    return createTableFn(this, options, waiterConfig);
  }

  /**
   * Deletes a DynamoDB table and waits for it to be confirmed deleted.
   *
   * @param options - DeleteTableCommandInput; TableName defaults to this.tableName.
   * @param waiterConfig - Waiter configuration (default maxWaitTime 60s).
   */
  async deleteTable(
    options: MakeOptional<DeleteTableCommandInput, 'TableName'> = {},
    waiterConfig: WaiterConfig = { maxWaitTime: 60 },
  ) {
    return deleteTableFn(this, options, waiterConfig);
  }

  /**
   * Puts an item to a DynamoDB table.
   *
   * @param item - EntityRecord object.
   * @param options - PutCommandInput with Item omitted; TableName optional.
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
   * @param options - PutCommandInput; TableName optional.
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
    options?: MakeOptional<Omit<PutCommandInput, 'Item'>, 'TableName'>,
  ): Promise<PutCommandOutput> {
    return putItemFn(this, itemOrOptions as never, options as never);
  }

  /**
   * Deletes an item from a DynamoDB table.
   *
   * @param key - EntityKey object.
   * @param options - DeleteCommandInput with Key omitted; TableName optional.
   *
   * @overload
   */
  async deleteItem(
    key: EntityKey<C>,
    options?: MakeOptional<Omit<DeleteCommandInput, 'Item'>, 'TableName'>,
  ): Promise<DeleteCommandOutput>;
  /**
   * Deletes an item from a DynamoDB table.
   *
   * @param options - DeleteCommandInput; TableName optional.
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
    options?: MakeOptional<Omit<DeleteCommandInput, 'Key'>, 'TableName'>,
  ): Promise<DeleteCommandOutput> {
    return deleteItemFn(this, keyOrOptions as never, options as never);
  }

  /**
   * Puts multiple items to a DynamoDB table in batches.
   *
   * @param items - Array of EntityRecord.
   * @param options - BatchWriteOptions.
   */
  async putItems(
    items: EntityRecord<C>[],
    options?: BatchWriteOptions,
  ): Promise<BatchWriteCommandOutput[]> {
    return putItemsFn(this, items, options ?? {});
  }

  /**
   * Deletes multiple items from a DynamoDB table in batches.
   *
   * @param keys - Array of EntityKey.
   * @param options - BatchWriteOptions.
   */
  async deleteItems(
    keys: EntityKey<C>[],
    options?: BatchWriteOptions,
  ): Promise<BatchWriteCommandOutput[]> {
    return deleteItemsFn(this, keys, options ?? {});
  }

  /**
   * Purge all items from a DynamoDB table.
   *
   * @param options - BatchWriteOptions.
   *
   * @returns Number of items purged.
   */
  async purgeItems(options?: BatchWriteOptions): Promise<number> {
    return purgeItemsFn(this, options ?? {});
  }

  /**
   * Puts multiple items as a single transaction.
   *
   * @param items - Array of EntityRecord.
   */
  async transactPutItems(
    items: EntityRecord<C>[],
  ): Promise<TransactWriteCommandOutput> {
    return transactPutItemsFn(this, items);
  }

  /**
   * Deletes multiple items as a single transaction.
   *
   * @param keys - Array of EntityKey.
   */
  async transactDeleteItems(
    keys: EntityKey<C>[],
  ): Promise<TransactWriteCommandOutput> {
    return transactDeleteItemsFn(this, keys);
  }

  /**
   * Token-aware getItem overloads (records). Strip keys in handlers when needed via entityManager.removeKeys.
   */
  // Token-aware with tuple projection (attributes as const)
  async getItem<ET extends EntityToken<C>, A extends readonly string[]>(
    entityToken: ET,
    key: EntityKey<C>,
    attributes: A,
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
    Omit<GetCommandOutput, 'Item'> & {
      Item?: Projected<EntityRecordByToken<C, ET>, A> | undefined;
    }
  >;
  // Token-aware with attributes string[]
  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
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
  ): Promise<
    Omit<GetCommandOutput, 'Item'> & {
      Item?: EntityRecordByToken<C, ET> | undefined;
    }
  >;
  // Token-aware without attributes (records)
  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
    key: EntityKey<C>,
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
    Omit<GetCommandOutput, 'Item'> & {
      Item?: EntityRecordByToken<C, ET> | undefined;
    }
  >;
  // Token-aware variant accepting a TableName-bearing GetCommandInput (kept per request)
  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
    options: MakeOptional<GetCommandInput, 'TableName'>,
  ): Promise<
    Omit<GetCommandOutput, 'Item'> & {
      Item?: EntityRecordByToken<C, ET> | undefined;
    }
  >;

  /**
   * Get item from a DynamoDB table.
   *
   * @param key - EntityKey object.
   * @param attributes - Item attributes to retrieve.
   * @param options - GetCommandInput with Key omitted; TableName optional.
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
   * @param key - EntityKey object.
   * @param options - GetCommandInput with Key omitted; TableName optional.
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
   * @param options - GetCommandInput; TableName optional.
   *
   * @overload
   */
  async getItem(
    options: MakeOptional<GetCommandInput, 'TableName'>,
  ): Promise<ReplaceKey<GetCommandOutput, 'Item', EntityRecord<C> | undefined>>;
  async getItem(...args: unknown[]): Promise<unknown> {
    // Normalize to: (token?), keyOrOptions, attributesOrOptions, options
    let keyOrOptions: EntityKey<C> | MakeOptional<GetCommandInput, 'TableName'>;
    let attributesOrOptions:
      | string[]
      | MakeOptional<Omit<GetCommandInput, 'Key'>, 'TableName'>
      | undefined;
    let options:
      | MakeOptional<
          Omit<
            GetCommandInput,
            | 'AttributesToGet'
            | 'ExpressionAttributeNames'
            | 'Key'
            | 'ProjectionExpression'
          >,
          'TableName'
        >
      | undefined;

    if (typeof args[0] === 'string') {
      // getItem(entityToken, key, attributes?, options?) OR getItem(entityToken, options)
      if (Array.isArray(args[2])) {
        keyOrOptions = args[1] as EntityKey<C>;
        attributesOrOptions = args[2] as string[];
        options = args[3] as typeof options;
      } else {
        // key + options OR options only
        if (args[1] && typeof args[1] === 'object' && 'TableName' in args[1]) {
          keyOrOptions = args[1] as MakeOptional<GetCommandInput, 'TableName'>;
          attributesOrOptions = undefined;
          options = undefined;
        } else {
          keyOrOptions = args[1] as EntityKey<C>;
          attributesOrOptions = undefined;
          options = args[2] as typeof options;
        }
      }
    } else {
      // legacy: getItem(key, attributes?, options?) OR getItem(options)
      keyOrOptions = args[0] as
        | EntityKey<C>
        | MakeOptional<GetCommandInput, 'TableName'>;
      attributesOrOptions = Array.isArray(args[1])
        ? (args[1] as string[])
        : (args[1] as never);
      options = (Array.isArray(args[1]) ? args[2] : args[1]) as typeof options;
    }

    const output = (await getItemFn(
      this,
      keyOrOptions as never,
      attributesOrOptions as never,
      options as never,
    )) as unknown as Omit<GetCommandOutput, 'Item'> & {
      Item?: Record<string, unknown> | undefined;
    };

    return output;
  }

  /**
   * Gets multiple items from a DynamoDB table in batches (records). Strip keys in handlers when needed via entityManager.removeKeys.
   *
   * @param keys - Array of EntityKey.
   * @param attributes - Optional list of attributes to project.
   * @param options - BatchGetOptions.
   */
  // Token-aware with tuple projection
  async getItems<ET extends EntityToken<C>, A extends readonly string[]>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: A,
    options?: BatchGetOptions,
  ): Promise<{
    items: Projected<EntityRecordByToken<C, ET>, A>[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Token-aware with attributes string[]
  async getItems<ET extends EntityToken<C>>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: string[],
    options?: BatchGetOptions,
  ): Promise<{
    items: EntityRecordByToken<C, ET>[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Token-aware without attributes
  async getItems<ET extends EntityToken<C>>(
    entityToken: ET,
    keys: EntityKey<C>[],
    options?: BatchGetOptions,
  ): Promise<{
    items: EntityRecordByToken<C, ET>[];
    outputs: BatchGetCommandOutput[];
  }>;
  /**
   * Gets multiple items from a DynamoDB table in batches.
   *
   * @param keys - Array of EntityKey.
   * @param attributes - Optional list of attributes to project.
   * @param options - BatchGetOptions.
   */
  async getItems(
    keys: EntityKey<C>[],
    attributes: string[],
    options?: BatchGetOptions,
  ): Promise<{ items: EntityRecord<C>[]; outputs: BatchGetCommandOutput[] }>;
  /**
   * Gets multiple items from a DynamoDB table in batches.
   *
   * @param keys - Array of EntityKey.
   * @param options - BatchGetOptions.
   */
  async getItems(
    keys: EntityKey<C>[],
    options?: BatchGetOptions,
  ): Promise<{ items: EntityRecord<C>[]; outputs: BatchGetCommandOutput[] }>;
  async getItems(...args: unknown[]): Promise<unknown> {
    // Normalize to: keys, attributesOrOptions, options
    let keys: EntityKey<C>[];
    let attributesOrOptions: string[] | BatchGetOptions | undefined;
    let options: BatchGetOptions | undefined;

    if (Array.isArray(args[0])) {
      // getItems(keys, attributes?, options?)
      keys = args[0] as EntityKey<C>[];
      if (Array.isArray(args[1])) {
        attributesOrOptions = args[1] as string[];
        options = args[2] as BatchGetOptions | undefined;
      } else {
        attributesOrOptions = args[1] as BatchGetOptions | undefined;
        options = args[2] as BatchGetOptions | undefined;
      }
    } else {
      // getItems(entityToken, keys, attributes?, options?)
      keys = args[1] as EntityKey<C>[];
      if (Array.isArray(args[2])) {
        attributesOrOptions = args[2] as string[];
        options = args[3] as BatchGetOptions | undefined;
      } else {
        attributesOrOptions = args[2] as BatchGetOptions | undefined;
        options = args[3] as BatchGetOptions | undefined;
      }
    }

    const result = Array.isArray(attributesOrOptions)
      ? await getItemsFn(this, keys, attributesOrOptions, options ?? {})
      : await getItemsFn(this, keys, attributesOrOptions ?? {});

    return result;
  }
}
