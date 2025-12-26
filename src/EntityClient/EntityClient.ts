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
   * @param item - EntityRecord object (storage-facing).
   * @param options - PutCommandInput with Item omitted; TableName optional.
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
    items: EMEntityRecord<C, EntityToken<C>>[],
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
   * Get an item by primary key (token-aware).
   *
   * @typeParam ET - Entity token (use a literal to narrow the return type).
   * @typeParam A - Projection tuple (use `as const` to narrow the projected shape).
   *
   * @param entityToken - Entity token used to narrow the record type.
   * @param key - Primary key for the item.
   * @param attributes - Optional projection attribute list.
   * @param options - Additional DocumentClient get options.
   *
   * @returns DynamoDB get output where `Item` (when present) is typed based on the token and projection.
   */
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
      Item?: EMEntityRecordPartial<C, ET, A> | undefined;
    }
  >;
  // Token-aware with attributes string[] -> cannot narrow at type level, return full DB record
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
      Item?: EMEntityRecord<C, ET> | undefined;
    }
  >;
  // Token-aware without attributes (records) -> full DB record
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
      Item?: EMEntityRecord<C, ET> | undefined;
    }
  >;
  // Token-aware variant accepting a TableName-bearing GetCommandInput
  async getItem<ET extends EntityToken<C>>(
    entityToken: ET,
    options: MakeOptional<GetCommandInput, 'TableName'>,
  ): Promise<
    Omit<GetCommandOutput, 'Item'> & {
      Item?: EMEntityRecord<C, ET> | undefined;
    }
  >;
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
      // Fallback not used (tokenless reads removed) - retain normalization for internal call paths.
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
   * Batch-get multiple items by primary key (token-aware).
   *
   * @typeParam ET - Entity token (use a literal to narrow the return type).
   * @typeParam A - Projection tuple (use `as const` to narrow the projected shape).
   *
   * @param entityToken - Entity token used to narrow the record type.
   * @param keys - Primary keys to fetch.
   * @param attributes - Optional projection attribute list.
   * @param options - {@link BatchGetOptions | `BatchGetOptions`} to control batching and request options.
   * @returns Items and raw batch outputs (including retry attempts).
   */
  // Token-aware with tuple projection
  async getItems<ET extends EntityToken<C>, A extends readonly string[]>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: A,
    options?: BatchGetOptions,
  ): Promise<{
    items: EMEntityRecordPartial<C, ET, A>[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Token-aware with attributes string[]
  async getItems<ET extends EntityToken<C>>(
    entityToken: ET,
    keys: EntityKey<C>[],
    attributes: string[],
    options?: BatchGetOptions,
  ): Promise<{
    items: EMEntityRecord<C, ET>[];
    outputs: BatchGetCommandOutput[];
  }>;
  // Token-aware without attributes
  async getItems<ET extends EntityToken<C>>(
    entityToken: ET,
    keys: EntityKey<C>[],
    options?: BatchGetOptions,
  ): Promise<{
    items: EMEntityRecord<C, ET>[];
    outputs: BatchGetCommandOutput[];
  }>;
  async getItems(...args: unknown[]): Promise<unknown> {
    // Normalize to: keys, attributesOrOptions, options
    let keys: EntityKey<C>[];
    let attributesOrOptions: string[] | BatchGetOptions | undefined;
    let options: BatchGetOptions | undefined;

    if (Array.isArray(args[0])) {
      // Fallback (not normally used; token-aware overloads preferred)
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
