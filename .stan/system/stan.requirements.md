# @karmaniverous/entity-client-dynamodb — Requirements (authoritative)

Scope

- This document defines the desired end state and durable behaviors for the entity-client-dynamodb package. It reflects:
  - The current implementation (EntityClient, QueryBuilder, Tables utilities, batch processing).
  - DX-focused typing enhancements delivered in this thread (token-aware literal removeKeys overloads; projection tuple narrowing).
  - Near-term intent consistent with upstream typing and local imports (CF-aware typing constraints in QueryBuilder and projection-aware query typing).

Environment and toolchain

- Node.js 18+; TypeScript 5+.
- Build: Rollup; outputs ESM + CJS + d.ts (preserveModules for JS, single d.ts bundle).
- Test: Vitest; integration against DynamoDB Local (Docker) using @karmaniverous/dynamodb-local.
- Lint/format: ESLint (flat config) with Prettier.

Data model (provider-agnostic baseline)

- The package is a DynamoDB adapter that plugs cleanly into the Entity Manager ecosystem:
  - EntityManager is configured upstream (schema, generated keys, indexes, shard bumps).
  - This package focuses on DynamoDB client ergonomics, batch operations, and a fluent query builder over AWS SDK v3 (DynamoDBDocument).

Package surfaces (high-level)

1. EntityClient<C extends BaseConfigMap>
   - Wraps DynamoDBClient + DynamoDBDocument and integrates with an EntityManager instance.
   - Options (extends DynamoDBClientConfig, excludes logger):
     - tableName: string (required) — default table target.
     - entityManager: EntityManager<C> (required).
     - logger?: { debug; error } (default: console).
     - enableXray?: boolean — capture AWS v3 client when AWS_XRAY_DAEMON_ADDRESS present.
     - batchProcessOptions?: default settings for batchProcess helper.
   - Public properties:
     - client: DynamoDBClient
     - doc: DynamoDBDocument (marshallOptions.removeUndefinedValues = true)
     - tableName: string
   - Tables:
     - createTable(options: CreateTableCommandInput|Omit<TableName>): waiter waitUntilTableExists; TableName defaults to this.tableName.
     - deleteTable(options?: DeleteTableCommandInput|Omit<TableName>): waiter waitUntilTableNotExists; TableName defaults to this.tableName.
   - Items (single):
     - putItem(item: EntityRecord<C>, options?) OR putItem(options: ReplaceKey<Item, EntityRecord<C>>): 200 ok or throw.
     - deleteItem(key: EntityKey<C>, options?) OR deleteItem(options: ReplaceKey<Key, EntityKey<C>>): 200 ok or throw.
     - getItem overloads (see “DX typing requirements” below for token-aware/literal projection typing):
       - token-aware forms return EntityRecordByToken<C, ET> | EntityItemByToken<C, ET> depending on removeKeys at runtime.
       - non-token forms return EntityRecord<C>.
       - supports attributes projection for both forms (AttributesToGet → ProjectionExpression/ExpressionAttributeNames).
   - Items (batch):
     - putItems(items: EntityRecord<C>[], options?): BatchWrite with retries until UnprocessedItems fully re-queued; returns BatchWriteCommandOutput[].
     - deleteItems(keys: EntityKey<C>[], options?): BatchWrite with retries; returns BatchWriteCommandOutput[].
     - transactPutItems(items): DocumentClient.transactWrite (Put); returns TransactWriteCommandOutput.
     - transactDeleteItems(keys): DocumentClient.transactWrite (Delete); returns TransactWriteCommandOutput.
     - purgeItems(options?): scan with LastEvaluatedKey loop; collect and batch delete only hashKey/rangeKey; returns number purged.
   - Logging and failures:
     - All methods log debug success contexts; on non-200 outcomes or exceptions, log error and throw with concise message.
     - No silent fallbacks; runtime semantics are explicit and deterministic.

2. QueryBuilder<C, ET, ITS, CF>
   - Extends BaseQueryBuilder from entity-manager and wires DocumentClient.query to ShardQueryFunction.
   - Construction (recommended factory already provided in package): createQueryBuilder({ entityClient, entityToken, hashKeyToken, cf? })
     - Infers ET from entityToken; when cf is provided (values-first literal), narrows ITS to keys of cf.indexes and page keys per index.
   - Query assembly:
     - indexParamsMap per indexToken holds:
       - expressionAttributeNames: Record<string, string>
       - expressionAttributeValues: Record<string, NativeScalarAttributeValue>
       - filterConditions: string[]
       - rangeKeyCondition?: string
       - scanIndexForward?: boolean
     - addRangeKeyCondition(indexToken, condition): one condition per index (no replacement except explicitly intended “between {} → replace” behavior for unbounded turns).
     - addFilterCondition(indexToken, condition): multiple filter conditions may be added; supports: <, <=, =, >, >=, <>, begins_with, between, in, contains, attribute_exists, attribute_not_exists, and/or/not with grouping.
   - Execution path:
     - getShardQueryFunction(indexToken) returns a ShardQueryFunction that builds a DocumentClient QueryCommandInput using getDocumentQueryArgs and executes doc.query.
     - The BaseQueryBuilder.query collates results via EntityManager.query (dedupe by uniqueProperty, sort by sortOrder, merge paging).
   - Typing guarantees (current):
     - ITS defaults to string; when cf is provided, ITS narrows to keys of cf.indexes; pageKey typing narrows per index.
     - RangeKey/filter condition property typing remains broad (string) at call sites today (see “Intent” for CF-aware narrowing).

3. Tables utilities
   - generateTableDefinition(entityManager): returns Pick<CreateTableCommandInput, 'AttributeDefinitions' | 'GlobalSecondaryIndexes' | 'KeySchema'> based on EntityManager config:
     - Builds AttributeDefinitions for global keys and any index component properties; uses defaultTranscodeAttributeTypeMap to map numeric transcodes (bigint/fix6/int/number/timestamp) to 'N'; others default to 'S'.
     - Produces all GSIs from config.indexes with projection policy:
       - Projections omitted => ProjectionType 'ALL'.
       - projections: [] => 'KEYS_ONLY'.
       - projections: string[] => 'INCLUDE' + NonKeyAttributes.
   - TranscodeAttributeTypeMap + defaultTranscodeAttributeTypeMap exported.

4. Low-level helper
   - getDocumentQueryArgs<C, ET, IT, CF>({ tableName, hashKeyToken, indexParamsMap, indexToken, hashKey, pageKey?, pageSize? }):
     - Assembles ExpressionAttributeNames/Values, KeyConditionExpression (hashKey + optional rangeKeyCondition), FilterExpression (AND-joined), Limit, ExclusiveStartKey, ScanIndexForward.
     - Accepts a per-index typed pageKey (via PageKeyByIndex).

Batch processing invariants

- putItems/deleteItems:
  - batchProcess keys/items, invoke BatchWrite for each batch, and implement unprocessedItemExtractor that returns the original Items/Keys from WriteRequest shapes.
  - Retries continue until no unprocessed items remain; return an array of outputs from all successful invocations.
- purgeItems:
  - Iterate via LastEvaluatedKey until fully exhausted; never rely on items.length sentinel for loop termination.

Logging and error policy

- logger implements { debug; error } (default console). All operations log success (debug) and failures (error with minimal context). Failures throw with a concise message; no swallowing.

DX and typing requirements (current)

Token-aware value stripping (removeKeys) — literal overloads

- getItem/getItems include additive token-aware overloads that narrow return types when options.removeKeys is a literal:
  - removeKeys: true — returns EntityItemByToken<C, ET> (domain item without generated/global keys).
  - removeKeys: false — returns EntityRecordByToken<C, ET> (record with generated/global keys).
  - When options.removeKeys is dynamic/omitted, maintain union types (EntityRecordByToken | EntityItemByToken).
- Behavior is type-only; at runtime, key stripping is applied only when a token-aware overload is used and options.removeKeys === true.

Projection tuple narrowing — token-aware calls

- getItem/getItems provide overloads that accept attributes as const tuples (readonly string[]). When used in token-aware forms:
  - Return Item/Record shapes narrow to Pick<…> over the projected keys (combined with the removeKeys literal when present).
  - Example:
    - getItems('user', keys, ['a', 'b'] as const, { removeKeys: true }) → items: Pick<EntityItemByToken<C, 'user'>, 'a' | 'b'>[]
    - getItem('user', key, ['a', 'b'] as const, { removeKeys: false }) → Item: Pick<EntityRecordByToken<C, 'user'>, 'a' | 'b'>
- This is compile-time only; runtime projection is implemented via ProjectionExpression/ExpressionAttributeNames in the adapter (already in place).

QueryBuilder typing guarantees (current)

- Page key typing by index (CF-aware):
  - When a values-first config literal (cf) with indexes is supplied via createQueryBuilder({ cf }), pageKey typing is narrowed per index via PageKeyByIndex.
  - ITS (index token subset) narrows to keys of cf.indexes; excess map keys are rejected by excess property checks.
- Filter/range key condition operators and shape:
  - RangeKeyCondition supports: '<' | '<=' | '=' | '>' | '>=' | '<>' | 'between' | 'begins_with'.
  - FilterCondition supports: comparison operators, begins_with, between, contains, attribute_exists/attribute_not_exists, in (array or Set), and/or/not groupings.
- Current typing for condition.property remains string to preserve compatibility (see “Intent” below for CF-aware narrowing).

Runtime query composition

- getShardQueryFunction(indexToken) constructs a ShardQueryFunction that calls getDocumentQueryArgs and executes DynamoDBDocument.query.
- BaseQueryBuilder.query (from entity-manager) handles shard fan-out, parallelism (throttle), dedupe by uniqueProperty, sort (SortOrder), and pageKey dehydration/rehydration across shards.

Intent (near-term; type-only, additive)

- CF-aware property narrowing in QueryBuilder:
  - When a config literal (cf) is provided, allow a type-only CF-aware narrowing so that addRangeKeyCondition’s condition.property can be constrained to the index rangeKey token for the selected index.
  - Constraint: must not introduce overload vs implementation incompatibilities; changes must be compatible with the imported addRangeKeyCondition helper (no runtime changes). If an overload approach is used, ensure the overload is a subtype of the implementation signature.

- Projection-aware query (upstream) and adapter alignment:
  - Upstream entity-manager introduces an optional K generic for projection keys; this adapter may opt into K to carry const-tuple projections end-to-end.
  - Policy: projection typing is type-only; at runtime the adapter should auto-include uniqueProperty and any explicit sort keys in ProjectionExpression to preserve dedupe/sort invariants when projections are provided.

Provider-specific boundaries (DynamoDB)

- Table/index assumptions:
  - EntityManager config expresses GSIs; generateTableDefinition mirrors that config (AttributeDefinitions, GSIs, KeySchema).
  - Page keys always include the record’s global hash and range keys (DynamoDB contract); PageKey dehydration/rehydration in entity-manager accounts for this; adapter must pass/receive these unmodified.
- Query shape:
  - Single-index, single-shard query at adapter level; elements of the cross-shard, cross-index fan-out are managed by entity-manager.

Public exports (DX)

- Re-export commonly used types for convenience:
  - EntityToken, EntityItemByToken, EntityRecordByToken (from entity-manager).
  - TranscodeAttributeTypeMap, defaultTranscodeAttributeTypeMap; generateTableDefinition; getDocumentQueryArgs; QueryBuilder and helpers.

Testing and integration

- Unit and integration tests must cover:
  - Table create/delete with waiter success.
  - put/get/delete for single items; round-trips on attributes projection.
  - Batch put/delete with retry paths; purge deletes all items; transacts succeed.
  - QueryBuilder addRangeKeyCondition/addFilterCondition behaviors (all operator branches); getDocumentQueryArgs assembly (filter + key conditions + page key).
  - DynamoDB Local integration stable across re-runs; test suite includes Docker preflight wait.

Performance and reliability

- Batch operations use @karmaniverous/batch-process with a safe unprocessed item extractor that returns original items/keys; retries until drained.
- Scan-based purge uses LastEvaluatedKey; no data-dependent termination.

Non-requirements

- No runtime projection enforcement based on type-only narrowing beyond what is already implemented in getItem/getItems with ProjectionExpression.
- No provider-agnostic modeling inside this adapter; complex sharding/page key logic remains in entity-manager.
- No breaking changes to public API shape for DX improvements; all typing enhancements remain additive and compile-time only.

Documentation

- Maintain README and Typedoc so that:
  - Token-aware semantics and overloads are visible (removeKeys literal narrowing; tuple-based projection narrowing).
  - QueryBuilder usage is demonstrated with and without cf; page-key typing and ITS narrowing explained.
  - Tables utility (generateTableDefinition) documented with examples and linkouts to AWS docs.
  - ExternalSymbolLinkMappings remain up to date to silence unresolved links in public comments.

Release and compatibility

- Literal removeKeys overloads and projection tuple narrowing are considered minor, additive DX changes (no runtime changes).
- CF-aware QueryBuilder property narrowing is a goal; any rollout must ensure typecheck/build/docs remain green (avoid overload/impl signature conflicts).

Quality gates

- Lint, typecheck, tests, docs, and build must pass prior to release.
- Large files (> ~300 LOC) must be proactively split; current structure adheres to this rule.

Examples (concise)

Token-aware + literal removeKeys:

```ts
// Records with keys
const res1 = await entityClient.getItems('user', keys, { removeKeys: false });
// res1.items: EntityRecordByToken<C, 'user'>[]

// Items without keys
const res2 = await entityClient.getItems('user', keys, { removeKeys: true });
// res2.items: EntityItemByToken<C, 'user'>[]
```

Tuple projection narrowing (token-aware):

```ts
const attrs = ['a', 'b'] as const;
const res3 = await entityClient.getItems('user', keys, attrs, {
  removeKeys: true,
});
// res3.items: Pick<EntityItemByToken<C, 'user'>, 'a' | 'b'>[]

const res4 = await entityClient.getItem('user', key, attrs, {
  removeKeys: false,
});
// res4.Item: Pick<EntityRecordByToken<C, 'user'>, 'a' | 'b'> | undefined
```

QueryBuilder (page-key typing by index; cf-aware ITS):

```ts
const qb = createQueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
  cf: myConfigLiteral, // narrows ITS and page-key typing per index
});
qb.addRangeKeyCondition('created', {
  operator: 'between',
  property: 'created',
  value: { from: 1, to: 2 },
});
qb.addFilterCondition('created', {
  operator: 'attribute_exists',
  property: 'updated',
});
const shardQueryMap = qb.build();
// Pass to entityManager.query({ entityToken: 'user', item: {}, shardQueryMap, ... })
```
