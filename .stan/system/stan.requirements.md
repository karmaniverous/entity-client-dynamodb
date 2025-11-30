# Entity Manager & DynamoDB Plugin — Requirements (authoritative)

Scope

- This document specifies the desired end state for:
  - Entity Manager (vNext) with an inference‑first, by‑token type model.
  - The DynamoDB get‑dotenv CLI plugin: versioned table lifecycle, data migration, and local DynamoDB orchestration.
- It supersedes prior guidance where conflicts arise and remains provider‑agnostic unless explicitly stated.
- Runtime semantics remain the same unless noted; the primary changes are type model/shape and API ergonomics.

Overview

- Entity Manager implements rational indexing and cross‑shard querying at scale in your NoSQL database so you can focus on application logic.
- The DynamoDB plugin provides operational tooling on top:
  - Opinionated, versioned table definitions (YAML with comment‑preserving refresh)
  - Validate/create/delete/purge flows
  - Version‑aware data migration (step‑wise; transforms; progress ticks)
  - Local DynamoDB orchestration (config‑first with embedded fallback)

---

## Entity Manager vNext — By‑token model (authoritative)

Core responsibilities

- Generate and maintain database‑facing keys (global hashKey and rangeKey) and other generated properties used by indexes.
- Encode/decode generated property elements via transcodes.
- Dehydrate/rehydrate page keys for multi‑index, cross‑shard paging.
- Execute provider‑agnostic, parallel shard queries through injected shard query functions, combining, de‑duplicating, and sorting results.

Key concepts and terminology

- Entity: application data type; accepts unknown keys (record‑like).
- Generated properties:
  - Sharded: include the hashKey value and one or more property=value elements; require all elements to be present (atomic), otherwise undefined.
  - Unsharded: one or more property=value elements; missing element values are encoded as empty strings.
- Keys:
  - Global hashKey (shared name across entities) with shard suffix.
  - Global rangeKey (shared name across entities) in the form "uniqueProperty#value".
- Shard bump: a time‑windowed rule (timestamp, charBits, chars) defining shard key width and radix for records created within/after that timestamp.
- Index components: tokens defining index hashKey and rangeKey. Tokens may be:
  - Global hashKey or rangeKey.
  - A sharded generated property (hashKey side only).
  - An unsharded generated property or a transcodable scalar property (rangeKey side).

Compatibility and assumptions

- Provider‑agnostic orchestration; intended to work with platforms like DynamoDB.
- Canonicalization (e.g., name search fields) is an application concern; Entity Manager treats such strings as opaque values and provides transcodes for ordering/encoding.

Non‑requirements (current behavior)

- No automatic fan‑out reduction relative to remaining limit in the query loop.
- No enforcement of globally unique (hashKey, rangeKey) pairs across separate index tokens.

### Inference‑first typing (refactor) — by‑token model

Goals

- Values‑first configuration: callers pass a literal config value; Entity Manager captures tokens and index names directly from the value (“as const” and “satisfies”).
- Token‑aware and index‑aware typing end‑to‑end: entity token (ET) and index token (IT/ITS) narrow items, records, page keys, shard query contracts, and query results without casts.
- Runtime behavior remains unchanged; the type surface is modernized for clarity and DX.

By‑token types (replacing legacy names)

- EntityItem<CC, ET>
  - Domain‑facing item narrowed to a specific entity token, plus optional key/token properties.
- EntityItemPartial<CC, ET, K = unknown>
  - Projected/seed domain shape by token.
  - If K provided: required projected keys (Pick by K).
  - If K omitted: permissive partial (seed).
- EntityRecord<CC, ET>
  - DB‑facing record (required keys) plus partial domain fields.
- EntityRecordPartial<CC, ET, K = unknown>
  - Projected DB record (Pick by K).

Projection‑aware typing (type‑only K channel; provider‑agnostic)

- K narrows shapes when present; otherwise items are permissive partials.
- Helper types:
  - KeysFrom<K> (normalize tuple/string to a key union)
  - Projected<T, K> (Pick on K)
- Query & shard contracts thread K consistently, e.g.:
  - ShardQueryFunction<CC, ET, IT, CF, K>
  - ShardQueryResult<CC, ET, IT, CF, K>
  - QueryOptions<CC, ET, ITS, CF, K>
  - QueryResult<CC, ET, ITS, K>

Zod‑schema‑first EM inference (no generics at call sites)

- Factory supports optional entitiesSchema: Record<entityToken, Zod schema>.
- When provided, EM is inferred as { [ET]: z.infer<typeof schema[ET]> } directly from values.
- When omitted, EM falls back to a broad EntityMap (no breaking change).
- Schemas define only non‑generated properties (base/domain fields). Do not include:
  - global keys (hashKey/rangeKey),
  - generated property tokens (sharded/unsharded).
- Runtime config parsing/validation persists (Zod). The parsed result is intersected with captured literal types at the type level.

Naming and acronym policy (hard rule)

- Acronyms are reserved for type‑parameter names only (e.g., CC, EM, ET, IT, ITS, CF, K).
- Never export abbreviated type aliases in public API. All exported type aliases must be fully named (e.g., EntityItemPartial, EntityRecordPartial, etc.).

Configuration model (runtime shape; validated with Zod)

- ParsedConfig (authoritative runtime object) includes:
  - entities: Record<entityToken, { timestampProperty; uniqueProperty; shardBumps?; defaultLimit?; defaultPageSize? }>
  - generatedProperties: { sharded: Record<ShardedKey, string[]>; unsharded: Record<UnshardedKey, string[]> }
  - indexes: Record<indexToken, { hashKey; rangeKey; projections? }>
  - propertyTranscodes: Record<TranscodedProperties, keyof TranscodeRegistry>
  - transcodes: Transcodes<TranscodeRegistry>
  - hashKey, rangeKey; delimiters; throttle

Runtime config validation (selected checks)

- Delimiters must be non‑word sequences, not containing each other.
- Key sets mutually exclusive; types consistent with transcodes.
- Generated elements non‑empty, unique, properly transcodable.
- Indexes valid (hash side: global or sharded generated; range side: global range, unsharded generated, or scalar).
- Entities valid; shardBumps sorted, monotonic; defaults injected.

Generated property encoding

- Sharded: "<hashKey>|k#v|k#v…" (atomic; undefined if any element nil).
- Unsharded: "k#v|k#v…" (missing → empty string).
- decodeGeneratedProperty reverses into EntityItemPartial patch.

Global key updates

- updateItemHashKey: computes shard suffix based on bump/window; returns updated hashKey.
- updateItemRangeKey: "uniqueProperty#value".
- addKeys/removeKeys/getPrimaryKey implement the expected flows.

Page key map dehydration/rehydration

- dehydratePageKeyMap: stable, typed emission per index/token/hashKey set; strings for compact carry‑over.
- rehydratePageKeyMap: validates index set; reconstructs per‑hash/per‑index typed keys; error on shape mismatch.

Shard space enumeration

- getHashKeySpace enumerates suffixes across shard bumps for a time window; yields properly formed global/alternate hash key values.

Query orchestration

- QueryOptions/QueryResult typed; de‑dupe by uniqueProperty and sort by provided order; rehydrate/dehydrate loop for paging; optional K type‑only narrowing.
- Adapter‑level projection policy (invariants):
  - When projections are supplied, adapters auto‑include uniqueProperty and explicit sort keys at runtime to preserve de‑dupe/sort invariants.

Adapter‑level QueryBuilder ergonomics (DynamoDB)

- setScanIndexForward(indexToken: ITS, value: boolean): this
  - Runtime: sets per‑index scan direction; reflected in getDocumentQueryArgs.
  - Typing: no effect on K.
- setProjection<KAttr extends readonly string[]>(indexToken: ITS, attrs: KAttr): QueryBuilder<…, KAttr>
- resetProjection(indexToken: ITS): QueryBuilder<…, unknown>
- resetAllProjections(): QueryBuilder<…, unknown>
- setProjectionAll<KAttr extends readonly string[]>(indices: ITS[] | readonly ITS[], attrs: KAttr): QueryBuilder<…, KAttr>
  - Runtime: uses ProjectionExpression; query() auto‑includes uniqueProperty + explicit sort keys to preserve invariants.
  - Typing: narrows K builder‑wide for a uniform projected shape.

Internals / variance (typing contract with adapters)

- Helper functions that operate on builder state SHOULD accept a minimal structural builder shape (indexParamsMap + logger) or a fully generic BaseQueryBuilder signature to avoid variance casts in downstream adapters.
- No runtime changes; type ergonomics only.

Acceptance criteria (Entity Manager)

- Values‑first factory compiles and captures literal tokens/index names from the provided config value.
- By‑token type family replaces legacy names across public typings and TypeDoc.
- Query contracts thread K (projection) consistently and align with adapter behavior.
- Adapter policy to auto‑include uniqueProperty + explicit sort keys when projections present is documented and tested in adapters (e.g., DynamoDB).

---

## DynamoDB get‑dotenv plugin and versioned migration (authoritative)

Scope and purpose

- Provide a robust, host‑aware get‑dotenv CLI plugin “dynamodb” for table lifecycle and data migration on top of Entity Manager and EntityClient (DynamoDB).
- Support versioned table definitions and transforms with strong typing, comment‑preserving YAML refresh, and streaming, large‑scale migrations.
- Keep EntityClient pure and type‑safe for application code; dynamic versioned resolution lives in plugin/utilities only.

Versioned layout (opinionated; configurable tokens)

- Default root: tables/ (configurable via tablesPath)
- Per‑version directory “NNN/” (zero‑padded):
  - entityManager.ts — value‑first EM config for that version (typed; optional, see resolution below).
  - table.yml — full AWS::DynamoDB::Table resource including Type and Properties (required for create‑table).
  - transform.ts — optional, per‑entity transform handlers from previous→this version.
- Root baseline template (optional): tables/table.template.yml for non‑generated Properties (billing, TTL, PITR, Streams, SSE, tags, etc.).
- Configurable tokens (plugin config):
  - tablesPath (default "tables")
  - tokens.table (default "table" → table.yml)
  - tokens.entityManager (default "entityManager" → entityManager.ts/.js)
  - tokens.transform (default "transform" → transform.ts/.js)
- File resolution supports .yml/.yaml and .ts/.js.

EntityManager resolution per step (prev → next)

- For a chain step V, resolve both “prev EM” and “next EM”:
  - Try V/entityManager.(ts|js); if absent, walk backward to the nearest lower version that defines entityManager.(ts|js).
  - If none found across ancestry for a role (prev/next), error with guidance to add an EM file or set an earlier floor version.
- Rationale:
  - Default transform behavior requires prev.removeKeys and next.addKeys.
  - Allows next EM to be optional when only non‑updatable properties changed (e.g., TableName) because fallback applies.

Table definition generation and refresh (comment‑preserving)

- generate‑table‑definition:
  - Compose or refresh tables/NNN/table.yml using:
    - Type: AWS::DynamoDB::Table
    - Properties:
      - Replace only generated sections from generateTableDefinition(entityManager):
        - AttributeDefinitions
        - KeySchema
        - GlobalSecondaryIndexes
      - Preserve all other Properties from:
        - Existing table.yml (when refreshing), or
        - Root baseline tables/table.template.yml (when creating new file), or
        - Empty object (no baseline).
  - YAML comment preservation is critical:
    - Parse into a CST‑backed Document (eemeli/yaml).
    - Update only the three generated child nodes under Properties; keep all comments/anchors/order elsewhere.
  - Warning banner (YAML comment at top of file):
    - “Generated sections (AttributeDefinitions, KeySchema, GlobalSecondaryIndexes) are overwritten by tooling. Edit baseline/template‑only. Use validate‑table‑definition to check drift.”
  - Optional overlays at generation time (applied once):
    - BillingMode, ProvisionedThroughput (RCU/WCU), TableName.
  - No per‑version template; only a root baseline template (tables/table.template.yml).

Validation and create‑table policy

- validate‑table‑definition:
  - Recompute the generated sections from resolved EM and compare to table.yml.
  - Exit non‑zero on drift (CI‑friendly).
- create‑table:
  - Reads tables/NNN/table.yml (required; errors if missing).
  - Defaults: validate=true, refreshGenerated=false.
  - Behavior:
    - If refreshGenerated: update generated nodes in place then create.
    - Else if validate=true: error on drift unless --force is provided.
  - TableName override:
    - Optional flag allows a one‑off override (merged into Properties at runtime only).
  - Waiter: maxSeconds configurable (default 60).

Delete and purge

- delete‑table:
  - TableName from flags/config/env; confirm unless --force; waiter with maxSeconds.
- purge‑table:
  - TableName from flags/config/env; confirm unless --force.

Data migration (version‑aware chain; streaming; progress)

- migrate‑data:
  - Inputs:
    - sourceTable, targetTable (dotenv‑expanded).
    - fromVersion, toVersion (zero‑padded).
    - tablesPath and tokens for versioned layout.
    - pageSize (default 100), limit (default Infinity).
    - transformConcurrency (default 1).
    - progressIntervalMs (default 2000).
  - Discovery:
    - Build step list K = { k | fromVersion < k ≤ toVersion } in ascending order.
    - For each k, resolve prev EM and next EM (fallback rules above).
    - Load transform.ts if present; normalize to TransformMap (see below).
  - Default chain (mandatory):
    - Missing transform.ts ⇒ default step for all entities:
      - item = prev.removeKeys(entityToken, record) // storage → domain
      - record’ = next.addKeys(entityToken, item) // domain → storage
      - return record’
  - Transform authoring (typed; async OK):
    - Handlers receive (record, ctx) where:
      - record: EntityRecord<PrevCM, ET>
      - ctx: { prev: EntityManager<PrevCM>; next: EntityManager<NextCM>; entityToken: ET }
    - Return values:
      - undefined → drop (no migration for this input record)
      - Single value → item/record for the same ET:
        - EntityItem<NextCM, ET>
        - EntityRecord<NextCM, ET>
      - Array of item/record → fan‑out for the same ET:
        - (EntityItem<NextCM, ET> | EntityRecord<NextCM, ET>)[]
    - Side effects permitted (async); transformConcurrency controls parallelism (default 1).
  - Streaming and batching:
    - Scan pages from source with Limit=pageSize and ExclusiveStartKey.
    - For each page:
      - Determine entityToken from the source record’s global hashKey string prefix (entity + shardKeyDelimiter from EM config).
      - Apply transform chain; normalize items to storage records (call next.addKeys if item returned).
      - Batch write to target via EntityClient.putItems(items, { tableName: targetTable }).
    - No whole‑table accumulation; memory bounded by page + in‑flight batches; unprocessed items retried via EntityClient utils.
  - Progress output:
    - Pages processed, items processed, items written, rolling items/sec rate emitted every progressIntervalMs.

Transform typing patterns (DX)

- Each version’s transform.ts imports types from its local EM to be step‑accurate:
  - import type { ConfigMap as PrevCM } from '../NNN-1/entityManager'
  - import type { ConfigMap as NextCM } from './entityManager'
  - export default defineTransformMap<PrevCM, NextCM>({ …handlers… })
- Identity helper: defineTransformMap preserves inference while keeping signatures concise.
- Cross‑entity fan‑out is not supported in v1; all outputs are interpreted for the same ET.

EntityClient posture (pure) and IDE guidance

- EntityClient remains pure; it requires an EntityManager at construction and does not perform dynamic versioned resolution internally.
- Application code:
  - Choose the “current” EM once (usually latest) and pass it into new EntityClient({ entityManager, … }).
  - Downstream, import only entityClient; refer to entityClient.entityManager when needed.
- The plugin/utilities handle dynamic EM resolution at runtime for migrations/Lifecycle tasks.

get‑dotenv integration (config, env tokens, precedence)

- Plugin reads once‑per‑invocation context from host (ctx = getCtx()).
- Every string option supports $VAR or ${VAR[:default]} and is expanded via dotenvExpand(value, ctx.dotenv).
- Resolution precedence for any option:
  1. CLI flag (dotenv‑expanded)
  2. getdotenv.config.\* under plugins.dynamodb (dotenv‑expanded)
  3. documented defaults
- Plugin config shape (getdotenv.config.\* → plugins.dynamodb):
  - tablesPath, tokens.{table,entityManager,transform}
  - generate: { version, overlays.{billingMode, readCapacityUnits, writeCapacityUnits, tableName}, force? }
  - validate: { version }
  - create: { version, validate, refreshGenerated, force, waiter.maxSeconds, tableNameOverride }
  - delete: { tableName, waiter.maxSeconds }
  - purge: { tableName }
  - migrate: {
    sourceTable, targetTable, fromVersion, toVersion,
    pageSize, limit, transformConcurrency, progressIntervalMs
    }
  - local: {
    port?, endpoint?, start?, stop?, status?
    }

YAML safety and formatting

- Use the yaml Document API with CST to:
  - Update only the generated nodes (Properties.AttributeDefinitions, Properties.KeySchema, Properties.GlobalSecondaryIndexes).
  - Preserve all other nodes, order, and comments.
- New files (no table.yml):
  - Compose from root baseline (if present) + generated nodes + comment banner.
- validate‑table‑definition compares generated sections normalized for stable order.

Errors and confirmations

- Destructive ops (purge/delete/migrate) prompt for confirm unless --force is provided.
- EM resolution failures produce actionable errors (list probed paths); instruct adding entityManager.ts at V or a lower version.
- Drift validation errors suggest running “generate‑table‑definition --force” or “create‑table --refresh‑generated”.

Performance limits and safety

- pageSize default 100; transformConcurrency default 1 to make side effects safe by default.
- No unbounded buffering; rely on DocumentClient batch write retry semantics for unprocessed items.

Local DynamoDB orchestration (config‑first with embedded fallback)

Commands

- dynamodb local start [--port <n>]
- dynamodb local stop
- dynamodb local status

Behavior and precedence

1. Config‑driven path (preferred when configured)
   - Execute verbatim command strings from `plugins.dynamodb.local.*` in get‑dotenv’s composed environment.
   - For start: after the configured start command returns, perform a readiness probe before returning success.
   - For status: when a status command is configured, return its exit code verbatim (0 = running/healthy).
   - For stop: execute and return non‑zero on operational failure.

2. Embedded fallback (only when no config command is set)
   - If `@karmaniverous/dynamodb-local` is installed (optional peer):
     - start: setupDynamoDbLocal(port) then dynamoDbLocalReady(client)
     - stop: teardownDynamoDbLocal()
     - status: AWS SDK health probe (ListTables) against derived endpoint
   - Otherwise, emit concise guidance and return non‑zero when invoked.

Endpoint & environment

- derive endpoint with this precedence:
  1. plugins.dynamodb.local.endpoint
  2. plugins.dynamodb.local.port → http://localhost:{port}
  3. DYNAMODB_LOCAL_ENDPOINT (env)
  4. Fallback: http://localhost:${DYNAMODB_LOCAL_PORT ?? '8000'}
- On successful start, print:
  - local dynamodb: endpoint <url>
  - Hint: export DYNAMODB_LOCAL_ENDPOINT=<url> so app code targets Local.

Shell/env/capture

- Compose env for children via buildSpawnEnv(process.env, ctx.dotenv).
- Honor host root options for shell selection (POSIX /bin/bash; Windows powershell.exe), and for capture (`GETDOTENV_STDIO=pipe` or `--capture`).

Acceptance criteria (DynamoDB plugin)

- Versioned layout respected; utilities resolve prev/next EM and transforms per step with documented fallback.
- generate‑table‑definition preserves comments and all non‑generated Properties across refresh; overwrites only generated sections; optional root baseline honored; header banner present.
- validate‑table‑definition detects drift in generated sections and exits non‑zero.
- create‑table validates by default; supports refresh‑generated; waiter supported; optional TableName override at runtime only.
- migrate‑data streams end‑to‑end with mandatory chain semantics:
  - Missing transform ⇒ default prev.removeKeys / next.addKeys.
  - TransformMap with async handling; returns undefined to drop; array to fan‑out; normalized to next records as required.
  - Progress printed at interval; performance flags respected.
- EntityClient usage remains pure and type‑safe in application code; dynamic versioned resolution is provided via plugin/utilities only.
- Local DynamoDB orchestration commands function per precedence; start waits for readiness; endpoint derivation and export hint printed.

---

## Adapter/Interop Notes (summarized alignment to by‑token model)

- Replace any legacy type names in downstream code (examples, docs, or templates) with:
  - EntityItem / EntityItemPartial (for domain)
  - EntityRecord / EntityRecordPartial (for DB)
- Token‑aware read APIs (recommended):
  - getItem(entityToken, key [, attributes as const])
  - getItems(entityToken, keys [, attributes as const])
- When K (projection) is present in QueryBuilder, ensure uniqueProperty and explicit sort keys are auto‑included at runtime; document this invariant alongside projected typing.
