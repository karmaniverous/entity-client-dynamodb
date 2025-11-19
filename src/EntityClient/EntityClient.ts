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
  type EntityItemByToken,
  type EntityKey,
  type EntityRecord,
  type EntityRecordByToken,
  type EntityToken,
} from '@karmaniverous/entity-manager';
import type { MakeOptional, ReplaceKey } from '@karmaniverous/entity-tools';
import AWSXray from 'aws-xray-sdk';

import type { BatchGetOptions } from './BatchGetOptions';
import type { BatchWriteOptions } from './BatchWriteOptions';
import type { EntityClientOptions } from './EntityClientOptions';
import type { GetItemOptions } from './GetItemOptions';
import type { GetItemsOptions } from './GetItemsOptions';
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
export class EntityClient<C extends BaseConfigMap> extends BaseEntityClient<C> {
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
   * Token-aware getItem overloads, with optional key stripping (removeKeys) in options.
   */
  // Literal-flag + attributes tuple (removeKeys true)
  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
    key: EntityKey<C>,
    attributes: readonly string[],
    options: GetItemOptions & { removeKeys: true },
  ): Promise<
    ReplaceKey<GetCommandOutput, 'Item', EntityItemByToken<C, ET> | undefined>
  >;
  // Literal-flag + attributes tuple (removeKeys false)
  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
    key: EntityKey<C>,
    attributes: readonly string[],
    options: GetItemOptions & { removeKeys: false },
  ): Promise<
    ReplaceKey<GetCommandOutput, 'Item', EntityRecordByToken<C, ET> | undefined>
  >;
  // Token-aware (no attributes) — conditional return based on removeKeys
  async getItem<
    ET extends EntityToken<C>,
    RK extends boolean | undefined = undefined,
  >(
    entityToken: ET,
    key: EntityKey<C>,
    options?: Omit<GetItemOptions, 'removeKeys'> & { removeKeys?: RK },
  ): Promise<
    ReplaceKey<
      GetCommandOutput,
      'Item',
      RK extends true
        ? EntityItemByToken<C, ET> | undefined
        : RK extends false
          ? EntityRecordByToken<C, ET> | undefined
          : EntityRecordByToken<C, ET> | EntityItemByToken<C, ET> | undefined
    >
  >;
  // Projection tuple narrowing when attributes is a const tuple
  async getItem<ET extends EntityToken<C>, A extends readonly string[]>(
    entityToken: ET,
    key: EntityKey<C>,
    attributes: A,
    options?: GetItemOptions,
  ): Promise<
    ReplaceKey<
      GetCommandOutput,
      'Item',
      | Projected<EntityRecordByToken<C, ET>, A>
      | Projected<EntityItemByToken<C, ET>, A>
      | undefined
    >
  >;

  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
    key: EntityKey<C>,
    attributes: string[],
    options?: GetItemOptions,
  ): Promise<
    ReplaceKey<
      GetCommandOutput,
      'Item',
      EntityRecordByToken<C, ET> | EntityItemByToken<C, ET> | undefined
    >
  >;

  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
    options: MakeOptional<GetCommandInput, 'TableName'>,
  ): Promise<
    ReplaceKey<
      GetCommandOutput,
      'Item',
      EntityRecordByToken<C, ET> | EntityItemByToken<C, ET> | undefined
    >
  >;

  /**
   * Get item from a DynamoDB table.
   *
   * @param key - EntityKey object.
   * @param attributes - Item attributes to retrieve.
   * @param options - GetCommandInput with Key & projection omitted; TableName optional.
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
    let entityToken: EntityToken<C> | undefined;
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
      | GetItemOptions
      | undefined;

    if (typeof args[0] === 'string') {
      // getItem(entityToken, key, attributes?, options?) OR getItem(entityToken, options)
      entityToken = args[0] as EntityToken<C>;
      if (Array.isArray(args[2])) {
        keyOrOptions = args[1] as EntityKey<C>;
        attributesOrOptions = args[2] as string[];
        options = args[3] as GetItemOptions | undefined;
      } else {
        // key + options OR options only
        if (args[1] && typeof args[1] === 'object' && 'TableName' in args[1]) {
          keyOrOptions = args[1] as MakeOptional<GetCommandInput, 'TableName'>;
          attributesOrOptions = undefined;
          options = undefined;
        } else {
          keyOrOptions = args[1] as EntityKey<C>;
          attributesOrOptions = undefined;
          options = args[2] as GetItemOptions | undefined;
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
      options = (Array.isArray(args[1]) ? args[2] : args[1]) as never;
    }

    const output = (await getItemFn(
      this,
      keyOrOptions as never,
      attributesOrOptions as never,
      options as never,
    )) as ReplaceKey<
      GetCommandOutput,
      'Item',
      Record<string, unknown> | undefined
    >;

    if (
      entityToken &&
      (options as GetItemOptions | undefined)?.removeKeys &&
      output.Item
    ) {
      return {
        ...output,
        Item: this.entityManager.removeKeys(entityToken, output.Item as never),
      } as unknown;
    }

    return output;
  }

  /**
   * Gets multiple items from a DynamoDB table in batches.
   *
   * @param keys - Array of EntityKey.
   * @param attributes - Optional list of attributes to project.
   * @param options - BatchGetOptions.
   */
  // Projection tuple + literal-flag (removeKeys true)
  async getItems<ET extends EntityToken<C>, A extends readonly string[]>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: A,
    options: GetItemsOptions & { removeKeys: true },
  ): Promise<{
    items: Projected<EntityItemByToken<C, ET>, A>[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Projection tuple + literal-flag (removeKeys false)
  async getItems<ET extends EntityToken<C>, A extends readonly string[]>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: A,
    options: GetItemsOptions & { removeKeys: false },
  ): Promise<{
    items: Projected<EntityRecordByToken<C, ET>, A>[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Projection tuple general (union)
  async getItems<ET extends EntityToken<C>, A extends readonly string[]>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: A,
    options?: GetItemsOptions,
  ): Promise<{
    items: Projected<
      EntityRecordByToken<C, ET> | EntityItemByToken<C, ET>,
      A
    >[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Token-aware with attributes string[]
  async getItems<ET extends EntityToken<C>>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: string[],
    options?: GetItemsOptions,
  ): Promise<{
    items: EntityRecordByToken<C, ET>[] | EntityItemByToken<C, ET>[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Token-aware (no attributes) — conditional return based on removeKeys
  async getItems<
    ET extends EntityToken<C>,
    RK extends boolean | undefined = undefined,
  >(
    entityToken: ET,
    keys: EntityKey<C>[],
    options?: Omit<GetItemsOptions, 'removeKeys'> & { removeKeys?: RK },
  ): Promise<{
    items: RK extends true
      ? EntityItemByToken<C, ET>[]
      : RK extends false
        ? EntityRecordByToken<C, ET>[]
        : EntityRecordByToken<C, ET>[] | EntityItemByToken<C, ET>[];
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
    options?: GetItemsOptions,
  ): Promise<{ items: EntityRecord<C>[]; outputs: BatchGetCommandOutput[] }>;
  async getItems(...args: unknown[]): Promise<unknown> {
    // Normalize to: keys, attributesOrOptions, options
    let keys: EntityKey<C>[];
    let attributesOrOptions: string[] | BatchGetOptions | undefined;
    let options: GetItemsOptions | undefined;

    if (Array.isArray(args[0])) {
      // getItems(keys, attributes?, options?)
      keys = args[0] as EntityKey<C>[];
      if (Array.isArray(args[1])) {
        attributesOrOptions = args[1] as string[];
        options = args[2] as GetItemsOptions | undefined;
      } else {
        attributesOrOptions = args[1] as GetItemsOptions | undefined;
        options = args[2] as GetItemsOptions | undefined;
      }
    } else {
      // getItems(entityToken, keys, attributes?, options?)
      keys = args[1] as EntityKey<C>[];
      if (Array.isArray(args[2])) {
        attributesOrOptions = args[2] as string[];
        options = args[3] as GetItemsOptions | undefined;
      } else {
        attributesOrOptions = args[2] as GetItemsOptions | undefined;
        options = args[3] as GetItemsOptions | undefined;
      }
    }

    const result = Array.isArray(attributesOrOptions)
      ? await getItemsFn(this, keys, attributesOrOptions, options ?? {})
      : await getItemsFn(this, keys, attributesOrOptions ?? {});

    const token =
      typeof args[0] === 'string' ? (args[0] as EntityToken<C>) : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (token && options?.removeKeys) {
      return {
        ...result,
        items: this.entityManager.removeKeys(token, result.items as never),
      } as unknown;
    }
    return result;
  }
}
