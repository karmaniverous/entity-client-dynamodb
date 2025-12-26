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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { EntityManager } from '@karmaniverous/entity-manager'; // imported to support API docs
import {
  type BaseConfigMap,
  BaseEntityClient,
  type EntityKey,
  type EntityRecord as EMEntityRecord,
  type EntityRecordPartial as EMEntityRecordPartial,
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

/**
 * Return type helper for {@link EntityClient.getItem | `EntityClient.getItem`}.
 *
 * TypeDoc requires this to be exported when it appears in an exported method signature.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam ET - Entity token.
 * @typeParam A - Optional projection tuple. If a const tuple is provided, `Item` is narrowed to the projected shape; otherwise it falls back to the full storage record shape.
 *
 * @category EntityClient
 */
export type GetItemOutput<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  A extends readonly string[] | undefined,
> = Omit<GetCommandOutput, 'Item'> & {
  Item?:
    | (A extends readonly string[]
        ? number extends A['length']
          ? EMEntityRecord<C, ET>
          : EMEntityRecordPartial<C, ET, A>
        : EMEntityRecord<C, ET>)
    | undefined;
};

/**
 * Return type helper for {@link EntityClient.getItems | `EntityClient.getItems`}.
 *
 * TypeDoc requires this to be exported when it appears in an exported method signature.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam ET - Entity token.
 * @typeParam A - Optional projection tuple. If a const tuple is provided, `items` are narrowed to the projected shape; otherwise they fall back to full storage record shapes.
 *
 * @category EntityClient
 */
export interface GetItemsOutput<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  A extends readonly string[] | undefined,
> {
  /** Items returned from DynamoDB, typed by token and projection tuple. */
  items: (A extends readonly string[]
    ? number extends A['length']
      ? EMEntityRecord<C, ET>
      : EMEntityRecordPartial<C, ET, A>
    : EMEntityRecord<C, ET>)[];
  /** Raw batch outputs (including retries). */
  outputs: BatchGetCommandOutput[];
}

/**
 * Convenience wrapper around the AWS DynamoDB SDK in addition to
 * {@link BaseEntityClient | BaseEntityClient} functionality.
 *
 * This class exposes {@link client | DynamoDBClient} and {@link doc | DynamoDBDocument}
 * for direct access, and delegates high-level operations to small helper modules.
 *
 * For query operations, use the {@link QueryBuilder | QueryBuilder} class.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam CF - Values-first config literal type carried by {@link EntityManager | `EntityManager`}.
 *
 * @category EntityClient
 */
export class EntityClient<
  C extends BaseConfigMap,
  CF = unknown,
> extends BaseEntityClient<C, CF> {
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
  constructor(options: EntityClientOptions<C, CF>) {
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
   *
   * @returns CreateTableCommand output and waiter result.
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
   *
   * @returns DeleteTableCommand output and waiter result.
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
   * @param item - EntityRecord object (storage-facing).
   * @param options - PutCommandInput with Item omitted; TableName optional.
   *
   * @returns DynamoDB {@link PutCommandOutput | `PutCommandOutput`}.
   *
   * @overload
   */
  async putItem(
    item: EMEntityRecord<C, EntityToken<C>>,
    options?: MakeOptional<Omit<PutCommandInput, 'Item'>, 'TableName'>,
  ): Promise<PutCommandOutput>;
  /**
   * Puts an item to a DynamoDB table.
   *
   * @param options - PutCommandInput; TableName optional.
   *
   * @returns DynamoDB {@link PutCommandOutput | `PutCommandOutput`}.
   *
   * @overload
   */
  async putItem(
    options: MakeOptional<
      ReplaceKey<PutCommandInput, 'Item', EMEntityRecord<C, EntityToken<C>>>,
      'TableName'
    >,
  ): Promise<PutCommandOutput>;
  async putItem(
    itemOrOptions:
      | EMEntityRecord<C, EntityToken<C>>
      | MakeOptional<
          ReplaceKey<
            PutCommandInput,
            'Item',
            EMEntityRecord<C, EntityToken<C>>
          >,
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
   * @returns DynamoDB {@link DeleteCommandOutput | `DeleteCommandOutput`}.
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
   * @returns DynamoDB {@link DeleteCommandOutput | `DeleteCommandOutput`}.
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
   *
   * @returns BatchWrite outputs (including any retry attempts).
   */
  async putItems(
    items: EMEntityRecord<C, EntityToken<C>>[],
    options?: BatchWriteOptions,
  ): Promise<BatchWriteCommandOutput[]> {
    return putItemsFn(this, items, options ?? {});
  }

  /**
   * Deletes multiple items from a DynamoDB table in batches.
   *
   * @param keys - Array of EntityKey.
   * @param options - BatchWriteOptions.
   *
   * @returns BatchWrite outputs (including any retry attempts).
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
   * @returns DynamoDB {@link TransactWriteCommandOutput | `TransactWriteCommandOutput`}.
   */
  async transactPutItems(
    items: EMEntityRecord<C, EntityToken<C>>[],
  ): Promise<TransactWriteCommandOutput> {
    return transactPutItemsFn(this, items);
  }

  /**
   * Deletes multiple items as a single transaction.
   *
   * @param keys - Array of EntityKey.
   * @returns DynamoDB {@link TransactWriteCommandOutput | `TransactWriteCommandOutput`}.
   */
  async transactDeleteItems(
    keys: EntityKey<C>[],
  ): Promise<TransactWriteCommandOutput> {
    return transactDeleteItemsFn(this, keys);
  }

  /**
   * Get an item by primary key (token-aware).
   *
   * @typeParam ET - Entity token (use a literal to narrow the record type).
   * @typeParam A - Optional projection tuple (use `as const` to narrow the projected shape).
   *
   * @param entityToken - Entity token used for type narrowing (no runtime effect).
   * @param keyOrOptions - Primary key OR a {@link GetCommandInput | `GetCommandInput`}-like options object.
   * @param attributesOrOptions - Projection attributes OR an options object.
   * @param options - Additional {@link GetCommandInput | `GetCommandInput`} options (TableName optional).
   *
   * @returns DynamoDB get output where `Item` (when present) is narrowed by token and projection tuple.
   */
  async getItem<
    ET extends EntityToken<C>,
    A extends readonly string[] | undefined = undefined,
  >(
    entityToken: ET,
    keyOrOptions: EntityKey<C> | MakeOptional<GetCommandInput, 'TableName'>,
    attributesOrOptions?:
      | A
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
  ): Promise<GetItemOutput<C, ET, A>> {
    // Token is type-only; the helper resolves key shape at runtime from the args.
    void entityToken;

    const output = await getItemFn<C, ET>(
      this,
      keyOrOptions as never,
      attributesOrOptions as never,
      options as never,
    );

    return output as unknown as GetItemOutput<C, ET, A>;
  }

  /**
   * Batch-get multiple items by primary key (token-aware).
   *
   * @typeParam ET - Entity token (use a literal to narrow the record type).
   * @typeParam A - Optional projection tuple (use `as const` to narrow the projected shape).
   *
   * @param entityToken - Entity token used for type narrowing (no runtime effect).
   * @param keys - Primary keys to fetch.
   * @param attributesOrOptions - Projection attributes OR {@link BatchGetOptions | `BatchGetOptions`}.
   * @param options - {@link BatchGetOptions | `BatchGetOptions`} when projection attributes are provided.
   *
   * @returns Items and raw batch outputs (including retry attempts).
   */
  async getItems<
    ET extends EntityToken<C>,
    A extends readonly string[] | undefined = undefined,
  >(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributesOrOptions?: A | BatchGetOptions,
    options?: BatchGetOptions,
  ): Promise<GetItemsOutput<C, ET, A>> {
    // Token is type-only; the helper is key-driven at runtime.
    void entityToken;

    const result = Array.isArray(attributesOrOptions)
      ? await getItemsFn<C, ET>(this, keys, attributesOrOptions, options ?? {})
      : await getItemsFn<C, ET>(this, keys, attributesOrOptions ?? {});

    return result as unknown as GetItemsOutput<C, ET, A>;
  }
}
