import { EntityMap, TranscodeMap, ConditionalProperty, Exactify, PropertiesOfType, TranscodableProperties, FlattenEntityMap, Transcodes, MutuallyExclusive, NotNever, DefaultTranscodeMap, SortOrder } from '@karmaniverous/entity-tools';
import { z } from 'zod';
import { BatchProcessOptions } from '@karmaniverous/batch-process';

/**
 * Default type parameter for {@link ConfigMap | `ConfigMap`}.
 *
 * @category EntityManager
 */
interface BaseConfigMap {
    EntityMap: EntityMap;
    HashKey: string;
    RangeKey: string;
    ShardedKeys: string;
    UnshardedKeys: string;
    TranscodedProperties: string;
    TranscodeMap: TranscodeMap;
}

/**
 * Defines a single time period in an entity sharding strategy.
 *
 * @category EntityManager
 * @protected
 */
interface ShardBump {
    /**
     * The timestamp marking the beginning of the time period. Must be a non-negative integer.
     *
     * This value must be unique across all {@link ShardBump | `ShardBumps`} for the entity.
     */
    timestamp: number;
    /**
     * The number of bits per character in the bump's shard space. For example, `0` yields a single shard per character, and a value of `2` would yield 4 shards per character.
     *
     * This value must be an integer between `1` and `5` inclusive.
     */
    charBits: number;
    /**
     * The number of characters used to represent the bump's shard key.
     *
     * This value must be an integer between `0` and `40` inclusive. Note that more than a few characters will result in an impossibly large shard space!   *
     * A ShardBump with `chars` of `2` and `charBits` of `3` would yield a two-character shard key with a space of 16 shards.
     */
    chars: number;
}

/**
 * Configuration object for an {@link EntityManager | `EntityManager`} instance.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines the configuration's {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 */
type Config<C extends BaseConfigMap = BaseConfigMap> = ConditionalProperty<'entities', keyof Exactify<C['EntityMap']>, {
    [E in keyof Exactify<C['EntityMap']>]: {
        defaultLimit?: number;
        defaultPageSize?: number;
        shardBumps?: ShardBump[];
        timestampProperty: C['TranscodedProperties'] & PropertiesOfType<C['EntityMap'][E], number> & TranscodableProperties<C['EntityMap'], C['TranscodeMap']>;
        uniqueProperty: C['TranscodedProperties'] & keyof C['EntityMap'][E] & TranscodableProperties<C['EntityMap'], C['TranscodeMap']>;
    };
}> & ConditionalProperty<'generatedProperties', C['ShardedKeys'] | C['UnshardedKeys'], ConditionalProperty<'sharded', C['ShardedKeys'], Record<C['ShardedKeys'], (C['TranscodedProperties'] & TranscodableProperties<C['EntityMap'], C['TranscodeMap']>)[]>> & ConditionalProperty<'unsharded', C['UnshardedKeys'], Record<C['UnshardedKeys'], (C['TranscodedProperties'] & TranscodableProperties<C['EntityMap'], C['TranscodeMap']>)[]>>> & ConditionalProperty<'propertyTranscodes', C['TranscodedProperties'] & TranscodableProperties<C['EntityMap'], C['TranscodeMap']>, {
    [P in C['TranscodedProperties'] & TranscodableProperties<C['EntityMap'], C['TranscodeMap']>]: PropertiesOfType<C['TranscodeMap'], FlattenEntityMap<C['EntityMap']>[P]>;
}> & ConditionalProperty<'transcodes', keyof C['TranscodeMap'], Transcodes<C['TranscodeMap']>> & {
    generatedKeyDelimiter?: string;
    generatedValueDelimiter?: string;
    hashKey: C['HashKey'];
    indexes?: Record<string, {
        hashKey: C['HashKey'] | C['ShardedKeys'];
        rangeKey: C['RangeKey'] | C['UnshardedKeys'] | (C['TranscodedProperties'] & TranscodableProperties<C['EntityMap'], C['TranscodeMap']>);
        projections?: string[];
    }>;
    rangeKey: C['RangeKey'];
    shardKeyDelimiter?: string;
    throttle?: number;
};

/**
 * Validates a type derived from {@link BaseConfigMap | `BaseConfigMap`} to ensure HashKey and RangeKey are both defined and that all sets of special keys are mutually exclusive.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
type ValidateConfigMap<C extends BaseConfigMap> = MutuallyExclusive<[
    C['HashKey'],
    C['RangeKey'],
    C['ShardedKeys'],
    C['UnshardedKeys'],
    keyof FlattenEntityMap<C['EntityMap']>
]> extends true ? NotNever<C, ['HashKey' | 'RangeKey']> extends true ? C : Exclude<NotNever<C, ['HashKey' | 'RangeKey']>, true> : Exclude<MutuallyExclusive<[
    C['HashKey'],
    C['RangeKey'],
    C['ShardedKeys'],
    C['UnshardedKeys'],
    keyof FlattenEntityMap<C['EntityMap']>
]>, true>;

/**
 * Generates & validates the map defining defines an {@link EntityManager | `EntityManager`} configuration's {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}.
 *
 * Unspecified properties will default to those defined in {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @typeParam M - {@link BaseConfigMap | `BaseConfigMap`} extension. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 */
type ConfigMap<M extends Partial<BaseConfigMap> = Partial<BaseConfigMap>> = ValidateConfigMap<{
    EntityMap: 'EntityMap' extends keyof M ? NonNullable<M['EntityMap']> : Record<string, never>;
    HashKey: 'HashKey' extends keyof M ? NonNullable<M['HashKey']> : 'hashKey';
    RangeKey: 'RangeKey' extends keyof M ? NonNullable<M['RangeKey']> : 'rangeKey';
    ShardedKeys: 'ShardedKeys' extends keyof M ? NonNullable<M['ShardedKeys']> : never;
    UnshardedKeys: 'UnshardedKeys' extends keyof M ? NonNullable<M['UnshardedKeys']> : never;
    TranscodedProperties: 'TranscodedProperties' extends keyof M ? NonNullable<M['TranscodedProperties']> : never;
    TranscodeMap: 'TranscodeMap' extends keyof M ? NonNullable<M['TranscodeMap']> : DefaultTranscodeMap;
}>;

/**
 * Extracts a database-facing partial item type from a {@link BaseConfigMap | `ConfigMap`}.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
type EntityItem<C extends BaseConfigMap> = Partial<FlattenEntityMap<C['EntityMap']> & Record<C['HashKey'] | C['RangeKey'] | C['ShardedKeys'] | C['UnshardedKeys'], string>> & Record<string, unknown>;

/**
 * Database-facing record key type from a {@link BaseConfigMap | `ConfigMap`} with required hash & range keys.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityClient
 * @protected
 */
type EntityKey<C extends BaseConfigMap> = Record<C['HashKey'] | C['RangeKey'], string>;

/**
 * Database-facing record type from a {@link BaseConfigMap | `ConfigMap`} with required hash & range keys.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
type EntityRecord<C extends BaseConfigMap> = EntityItem<C> & EntityKey<C>;

/**
 * Extracts entity tokens from a {@link ConfigMap | `ConfigMap`}.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
type EntityToken<C extends BaseConfigMap> = keyof Exactify<C['EntityMap']> & string;

declare const configSchema: z.ZodObject<{
    entities: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        defaultLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        defaultPageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        shardBumps: z.ZodPipe<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            timestamp: z.ZodNumber;
            charBits: z.ZodNumber;
            chars: z.ZodNumber;
        }, z.core.$strict>>>>, z.ZodTransform<{
            timestamp: number;
            charBits: number;
            chars: number;
        }[], {
            timestamp: number;
            charBits: number;
            chars: number;
        }[]>>;
        timestampProperty: z.ZodString;
        uniqueProperty: z.ZodString;
    }, z.core.$strict>>>>;
    generatedProperties: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        sharded: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>>;
        unsharded: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>>;
    }, z.core.$strip>>>;
    hashKey: z.ZodString;
    indexes: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        hashKey: z.ZodString;
        rangeKey: z.ZodString;
        projections: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>>;
    generatedKeyDelimiter: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    generatedValueDelimiter: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    propertyTranscodes: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>>;
    rangeKey: z.ZodString;
    shardKeyDelimiter: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    throttle: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    transcodes: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        encode: z.ZodCustom<unknown, unknown>;
        decode: z.ZodCustom<unknown, unknown>;
    }, z.core.$strict>>>>;
}, z.core.$strict>;
/**
 * Simplified type taken on by a {@link Config | `Config`} object after parsing in the {@link EntityManager | `EntityManager`} constructor.
 *
 * @category EntityManager
 */
type ParsedConfig = z.infer<typeof configSchema>;

/**
 * A partial {@link EntityItem | `EntityItem`} restricted to keys defined in `C`.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category QueryBuilder
 * @protected
 */
type PageKey<C extends BaseConfigMap> = Pick<EntityItem<C>, C['HashKey'] | C['RangeKey'] | C['ShardedKeys'] | C['UnshardedKeys'] | C['TranscodedProperties']>;

/**
 * A result returned by a {@link ShardQueryFunction | `ShardQueryFunction`} querying an individual shard.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
interface ShardQueryResult<C extends BaseConfigMap> {
    /** The number of records returned. */
    count: number;
    /** The returned records. */
    items: EntityItem<C>[];
    /** The page key for the next query on this shard. */
    pageKey?: PageKey<C>;
}

/**
 * A query function that returns a single page of results from an individual shard.
 *
 * This function will typically be composed dynamically to express a specific query index & logic. The arguments to this function will be provided by the {@link EntityManager.query | `EntityManager.query`} method, which assembles many returned pages queried across multiple shards into a single query result.
 *
 * @param hashKey - The hash key value of the shard being queried.
 * @param pageKey - The {@link PageKey | `PageKey`} returned by the previous query on this shard.
 * @param pageSize - The maximum number of items to return from this query.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
type ShardQueryFunction<C extends BaseConfigMap> = (hashKey: string, pageKey?: PageKey<C>, pageSize?: number) => Promise<ShardQueryResult<C>>;

/**
 * Relates a specific index token to a {@link ShardQueryFunction | `ShardQueryFunction`} to be performed on that index.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
type ShardQueryMap<C extends BaseConfigMap> = Record<string, ShardQueryFunction<C>>;

/**
 * Options passed to the {@link EntityManager.query | `EntityManager.query`} method.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
interface QueryOptions<C extends BaseConfigMap> {
    /** Identifies the entity to be queried. Key of {@link Config | `Config`} `entities`. */
    entityToken: EntityToken<C>;
    /**
     * Partial item object sufficiently populated to generate index hash keys.
     */
    item: EntityItem<C>;
    /**
     * The target maximum number of records to be returned by the query across
     * all shards.
     *
     * The actual number of records returned will be a product of {@link QueryOptions.pageSize | `pageSize`} and the
     * number of shards queried, unless limited by available records in a given
     * shard.
     */
    limit?: number;
    /**
     * {@link QueryResult.pageKeyMap | `pageKeyMap`} returned by the previous iteration of this query.
     */
    pageKeyMap?: string;
    /**
     * The maximum number of records to be returned by each individual query to a
     * single shard (i.e. {@link ShardQueryFunction | `ShardQueryFunction`} execution).
     *
     * Note that, within a given {@link EntityManager.query | `query`} method execution, these queries will be
     * repeated until either available data is exhausted or the {@link QueryOptions.limit | `limit`} value is
     * reached.
     */
    pageSize?: number;
    /**
     * Each key in this object is a valid entity index token. Each value is a valid
     * {@link ShardQueryFunction | 'ShardQueryFunction'} that specifies the query of a single page of data on a
     * single shard for the mapped index.
     *
     * This allows simultaneous queries on multiple sort keys to share a single
     * page key, e.g. to match the same string against `firstName` and `lastName`
     * properties without performing a table scan for either.
     */
    shardQueryMap: ShardQueryMap<C>;
    /**
     * A {@link SortOrder | `SortOrder`} object specifying the sort order of the result set. Defaults to `[]`.
     */
    sortOrder?: SortOrder<EntityItem<C>>;
    /**
     * Lower limit to query shard space.
     *
     * Only valid if the query is constrained along the dimension used by the
     * {@link Config | `EntityManager.config.entities.<entityToken>.sharding.timestamptokens.timestamp`}
     * function to generate `shardKey`.
     *
     * @defaultValue `0`
     */
    timestampFrom?: number;
    /**
     * Upper limit to query shard space.
     *
     * Only valid if the query is constrained along the dimension used by the
     * {@link Config | `EntityManager.config.entities.<entityToken>.sharding.timestamptokens.timestamp`}
     * function to generate `shardKey`.
     *
     * @defaultValue `Date.now()`
     */
    timestampTo?: number;
    /**
     * The maximum number of shards to query in parallel. Overrides options `throttle`.
     *
     * @defaultValue `options.throttle`
     */
    throttle?: number;
}

/**
 * A result returned by a query across multiple shards, where each shard may receive multiple page queries via a dynamically-generated {@link ShardQueryFunction | `ShardQueryFunction`}.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityManager
 * @protected
 */
interface QueryResult<C extends BaseConfigMap> {
    /** Total number of records returned across all shards. */
    count: number;
    /** The returned records. */
    items: EntityItem<C>[];
    /**
     * A compressed, two-layer map of page keys, used to query the next page of
     * data for a given sort key on each shard of a given hash key.
     */
    pageKeyMap: string;
}

/**
 * The EntityManager class applies a configuration-driven sharded data model &
 * query strategy to NoSql data.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines the configuration's {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @remarks
 * While the {@link EntityManager.query | `query`} method is `public`, normally it should not be called directly. The `query` method is used by a platform-specific {@link BaseQueryBuilder.query | `QueryBuilder.query`} method to provide a fluent query API.
 *
 * @category EntityManager
 */
declare class EntityManager<C extends BaseConfigMap> {
    #private;
    /** Logger object (defaults to `console`, must support `debug` & `error` methods). */
    readonly logger: Pick<Console, 'debug' | 'error'>;
    /**
     * Create an EntityManager instance.
     *
     * @param config - EntityManager {@link Config | `Config`} object.
     * @param logger - Logger object (defaults to `console`, must support `debug` & `error` methods).
     */
    constructor(config: Config<C>, logger?: Pick<Console, 'debug' | 'error'>);
    /**
     * Get the current EntityManager {@link Config | `Config`} object.
     *
     * @returns Current {@link Config | `Config`} object.
     */
    get config(): ParsedConfig;
    /**
     * Set the current EntityManager {@link Config | `Config`} object.
     *
     * @param value - {@link Config | `Config`} object.
     */
    set config(value: ParsedConfig);
    /**
     * Encode a generated property value. Returns a string or undefined if atomicity requirement of sharded properties not met.
     *
     * @param property - {@link Config | Config} `generatedProperties` key.
     * @param item - {@link EntityItem | `EntityItem`} object.
     *
     * @returns Encoded generated property value.
     *
     * @throws `Error` if `property` is not a {@link Config | Config} `generatedProperties` key.
     */
    encodeGeneratedProperty<C extends BaseConfigMap>(property: C['ShardedKeys'] | C['UnshardedKeys'], item: EntityItem<C>): string | undefined;
    /**
     * Update generated properties, hash key, and range key on an {@link EntityItem | `EntityItem`} object.
     *
     * @param entityToken - {@link Config | `Config`} `entities` key.
     * @param item - {@link EntityItem | `EntityItem`} object.
     * @param overwrite - Overwrite existing properties (default `false`).
     *
     * @returns {@link EntityRecord | `EntityRecord`} object with updated properties.
     *
     * @throws `Error` if `entityToken` is invalid.
     *
     * @overload
     */
    addKeys(entityToken: EntityToken<C>, item: EntityItem<C>, overwrite?: boolean): EntityRecord<C>;
    /**
     * Update generated properties, hash key, and range key on an array of {@link EntityItem | `EntityItem`} objects.
     *
     * @param entityToken - {@link Config | `Config`} `entities` key.
     * @param item - Array of {@link EntityItem | `EntityItem`} objects.
     * @param overwrite - Overwrite existing properties (default `false`).
     *
     * @returns An array of {@link EntityRecord | `EntityRecord`} objects with updated properties.
     *
     * @throws `Error` if `entityToken` is invalid.
     *
     * @overload
     */
    addKeys(entityToken: EntityToken<C>, item: EntityItem<C>[], overwrite?: boolean): EntityRecord<C>[];
    /**
     * Convert one or more {@link EntityItem | `EntityItem`} objects into an array of {@link EntityKey | `EntityKey`} values.
     *
     * @param entityToken - {@link Config | `Config`} `entities` key.
     * @param item - {@link EntityItem | `EntityItem`} object, or array of them.
     * @param overwrite - Overwrite existing properties (default `false`).
     *
     * @returns An array of {@link EntityKey | `EntityKey`} values. For a single input item, returns 0..N keys (usually 1).
     *          For an array input, returns a single flattened array of keys across all inputs.
     *
     * @throws `Error` if `entityToken` is invalid.
     */
    getPrimaryKey(entityToken: EntityToken<C>, item: EntityItem<C>, overwrite?: boolean): EntityKey<C>[];
    getPrimaryKey(entityToken: EntityToken<C>, items: EntityItem<C>[], overwrite?: boolean): EntityKey<C>[];
    /**
     * Strips generated properties, hash key, and range key from an {@link EntityRecord | `EntityRecord`} object.
     *
     * @param entityToken - {@link Config | `Config`} `entities` key.
     * @param item - {@link EntityRecord | `EntityRecord`} object.
     *
     * @returns {@link EntityItem | `EntityItem`} with generated properties, hash key & range key removed.
     *
     * @throws `Error` if `entityToken` is invalid.
     *
     * @overload
     */
    removeKeys(entityToken: EntityToken<C>, item: EntityRecord<C>): EntityItem<C>;
    /**
     * Strips generated properties, hash key, and range key from an array of {@link EntityRecord | `EntityRecord`} objects.
     *
     * @param entityToken - {@link Config | `Config`} `entities` key.
     * @param items - Array of {@link EntityRecord | `EntityRecord`} objects.
     *
     * @returns Array of {@link EntityItem | `EntityItem`} objects with generated properties, hash key & range key removed.
     *
     * @throws `Error` if `entityToken` is invalid.
     *
     * @overload
     */
    removeKeys(entityToken: EntityToken<C>, items: EntityRecord<C>[]): EntityItem<C>[];
    /**
     * Find an index token in a {@link Config | `Config`} object based on the index `hashKey` and `rangeKey`.
     *
     * @param hashKeyToken - Index hash key.
     * @param rangeKeyToken - Index range key.
     * @param suppressError - Suppress error if no match found.
     *
     * @returns  Index token if found.
     *
     * @throws `Error` if no match found and `suppressError` is not `true`.
     */
    findIndexToken(hashKeyToken: string, rangeKeyToken: string, suppressError?: boolean): string | undefined;
    /**
     * Query a database entity across shards in a provider-generic fashion.
     *
     * @remarks
     * The provided `shardQueryMap` performs the actual query of individual data pages on individual index/shard combinations.
     *
     * Individual shard query results will be combined, deduped by {@link Config | `Config`} `uniqueProperty` value, and sorted by {@link QueryOptions.sortOrder | `sortOrder`}.
     *
     * In queries on sharded data, expect the leading and trailing edges of returned data pages to interleave somewhat with preceding & following pages.
     *
     * Unsharded query results should sort & page as expected.
     *
     * **Normally this method should not be called directly!** It is used by a platform-specific {@link BaseQueryBuilder.query | `QueryBuilder.query`} method to provide a fluent query API.
     *
     * @param options - {@link QueryOptions | `QueryOptions`} object.
     *
     * @returns {@link QueryResult} object.
     *
     * @throws Error if `options` {@link QueryOptions.pageKeyMap | `pageKeyMap`} `pageKeyMap` keys do not match {@link QueryOptions.shardQueryMap | `shardQueryMap`} keys.
     *
     * @protected
     */
    query(options: QueryOptions<C>): Promise<QueryResult<C>>;
}

/**
 * Base EntityClient options.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityClient
 */
interface BaseEntityClientOptions<C extends BaseConfigMap> {
    /** Default batch process options. */
    batchProcessOptions?: Omit<BatchProcessOptions<unknown, unknown>, 'batchHandler' | 'unprocessedItemExtractor'>;
    /** {@link EntityManager | `EntityManager`} instance. */
    entityManager: EntityManager<C>;
    /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
    logger?: Pick<Console, 'debug' | 'error'>;
}

/**
 * Base EntityClient class. Integrates {@link EntityManager | `EntityManager`} with injected logging & enhanced batch processing.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category EntityClient
 */
declare abstract class BaseEntityClient<C extends BaseConfigMap> {
    /** Default batch process options. */
    readonly batchProcessOptions: NonNullable<BaseEntityClientOptions<C>['batchProcessOptions']>;
    /** {@link EntityManager | `EntityManager`} instance. */
    readonly entityManager: EntityManager<C>;
    /** Injected logger object. Must support `debug` and `error` methods. Default: `console` */
    readonly logger: NonNullable<BaseEntityClientOptions<C>['logger']>;
    /**
     * DynamoDB EntityClient constructor.
     *
     * @param options - {@link BaseEntityClientOptions | `BaseEntityClientOptions`} object.
     */
    constructor(options: BaseEntityClientOptions<C>);
}

/**
 * Constructor options for {@link BaseQueryBuilder | `BaseQueryBuilder`}.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 * @typeParam EntityClient - {@link BaseEntityClient | `BaseEntityClient`} derived class instance.
 *
 * @category QueryBuilder
 */
interface BaseQueryBuilderOptions<C extends BaseConfigMap, EntityClient extends BaseEntityClient<C>> {
    /** {@link BaseEntityClient | `EntityClient`} instance. */
    entityClient: EntityClient;
    /** Entity token. */
    entityToken: EntityToken<C>;
    /** Hash key token. */
    hashKeyToken: C['HashKey'] | C['ShardedKeys'];
    /** Dehydrated page key map. */
    pageKeyMap?: string;
}

/**
 * Options for {@link BaseQueryBuilder.query | `query`} method on all derived classes.
 *
 * Same as {@link QueryOptions | `QueryOptions`} for {@link EntityManager.query | `EntityManager.query`}, excluding `entityToken`, `pageKeyMap`, and `shardQueryMap`.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 *
 * @category QueryBuilder
 */
type QueryBuilderQueryOptions<C extends BaseConfigMap> = Omit<QueryOptions<C>, 'entityToken' | 'pageKeyMap' | 'shardQueryMap'>;

/**
 * Abstract base class supporting a fluent API for building a {@link ShardQueryMap | `ShardQueryMap`} using a database client.
 *
 * @typeParam C - {@link ConfigMap | `ConfigMap`} that defines an {@link Config | `EntityManager configuration`}'s {@link EntityMap | `EntityMap`}, key properties, and {@link TranscodeMap | `TranscodeMap`}. If omitted, defaults to {@link BaseConfigMap | `BaseConfigMap`}.
 * @typeParam EntityClient - {@link BaseEntityClient | `BaseEntityClient`} derived class instance.
 * @typeParam IndexParams - Database platform-specific, index-specific query parameters.
 *
 * @category QueryBuilder
 */
declare abstract class BaseQueryBuilder<C extends BaseConfigMap, EntityClient extends BaseEntityClient<C>, IndexParams> {
    /** {@link BaseEntityClient | `EntityClient`} instance. */
    readonly entityClient: EntityClient;
    /** Entity token. */
    readonly entityToken: EntityToken<C>;
    /** Hash key token. */
    readonly hashKeyToken: C['HashKey'] | C['ShardedKeys'];
    /** Dehydrated page key map. */
    readonly pageKeyMap?: string;
    /**
     * Maps `indexToken` values to database platform-specific query parameters.
     *
     * @protected
     */
    readonly indexParamsMap: Record<string, IndexParams>;
    /** BaseQueryBuilder constructor. */
    constructor(options: BaseQueryBuilderOptions<C, EntityClient>);
    protected abstract getShardQueryFunction(indexToken: string): ShardQueryFunction<C>;
    /**
     * Builds a {@link ShardQueryMap | `ShardQueryMap`} object.
     *
     * @returns - The {@link ShardQueryMap | `ShardQueryMap`} object.
     */
    build(): ShardQueryMap<C>;
    query(options: QueryBuilderQueryOptions<C>): Promise<QueryResult<C>>;
}

export { BaseEntityClient, BaseQueryBuilder, EntityManager, configSchema };
export type { BaseConfigMap, BaseEntityClientOptions, BaseQueryBuilderOptions, Config, ConfigMap, EntityItem, EntityKey, EntityRecord, EntityToken, PageKey, ParsedConfig, QueryBuilderQueryOptions, QueryOptions, QueryResult, ShardBump, ShardQueryFunction, ShardQueryMap, ShardQueryResult, ValidateConfigMap };
