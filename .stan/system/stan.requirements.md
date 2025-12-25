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
  - transform.ts — optional, per‑step transforms from previous→this version.
- Root baseline template (optional): tables/table.template.yml for non‑generated Properties (billing, TTL, PITR, Streams, SSE, tags, etc.).
- Configurable tokens (plugin config):
  - tablesPath (default "tables")
  - minTableVersionWidth (default 3; minimum zero-padding width when formatting version tokens; tokens may exceed this width, e.g., width=2 permits 99 then 100)
  - Version comparisons and step ordering MUST be by numeric value, not lexicographic directory token ordering.
  - Duplicate numeric values across directory tokens (e.g., 1 and 001) MUST error with guidance to remove/rename one directory.
  - tokens.table (default "table" → table.yml)
  - tokens.entityManager (default "entityManager" → entityManager.ts/.js)
  - tokens.transform (default "transform" → transform.ts/.js)
- File resolution supports .ts and .js for EM/transform modules.

EntityManager resolution per step (prev → next)

- For a chain step V, resolve both “prev EM” and “next EM”:
  - Try V/entityManager.(ts|js); if absent, walk backward to the nearest lower version that defines entityManager.(ts|js).
  - If none found across ancestry for a role (prev/next), error with guidance.

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
  - Managed table properties (NOT dotenv overlays):
    - generate.tableProperties may optionally declare non-generated table Properties keys as tooling-managed:
      - BillingMode
      - ProvisionedThroughput (RCU/WCU)
      - TableName
    - When provided, these managed table properties MUST be applied on every generate/refresh run.
    - When not provided, these keys MUST be preserved (no mutation).
    - If ProvisionedThroughput is managed, BillingMode MUST also be explicitly managed and MUST be PROVISIONED (no implicit behavior).
    - If BillingMode is managed as PROVISIONED, ProvisionedThroughput MUST be present and complete (RCU+WCU) or generation MUST error.
  - generate CLI UX:
    - Remove generate --force.
    - Add generate --clean to recompose from baseline + generated + managed properties; no confirmation required.

Validation and create‑table policy

- validate‑table‑definition:
  - Recompute the generated sections from resolved EM and compare to table.yml (order-insensitive).
  - When managed table properties are configured, validate MUST also enforce drift detection for those managed keys.
  - Exit non‑zero on drift (CI‑friendly).
- create‑table:
  - Reads tables/NNN/table.yml (required; errors if missing).
  - Defaults: validate=true, refreshGenerated=false.
  - Behavior:
    - If refreshGenerated: update generated nodes AND apply managed table properties in place then create.
    - Else if validate=true: error on drift unless --force is provided.
  - Non-latest create guard:
    - Creating a table at a non-latest version is unsafe by default and MUST be rejected in all environments.
    - The CLI MUST support an explicit override flag --allow-non-latest to permit creating a non-latest version.
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
  - Version existence guard:
    - Both fromVersion and toVersion MUST correspond to existing version directories under tablesPath (numeric value match).
    - If either boundary does not exist, migration MUST error with guidance (never silently no-op).
  - Discovery:
    - Build step list K = { k | fromVersion < k ≤ toVersion } in ascending order (numeric).
    - For each k, resolve prev and next EntityManagers with fallback.
    - Load optional transform.ts; otherwise use default chain.
  - Default chain:
    - prev.removeKeys(entityToken, record) -> next.addKeys(entityToken, item)
  - Transform semantics:
    - undefined → drop
    - single → migrate one
    - array → fan-out
  - Progress ticks and concurrency knobs as documented.

get‑dotenv integration (config, env tokens, precedence)

- Plugin reads once‑per‑invocation context from host (ctx = getCtx()).
- Resolution precedence for any option:
  1. CLI flag (dotenv‑expanded)
  2. getdotenv.config.\* under plugins.dynamodb (dotenv‑expanded)
  3. documented defaults
- Version flag strictness:
  - Commands that operate on a version (generate, validate, create, migrate) MUST require an explicit version value after host/config interpolation; missing/empty/non-numeric versions MUST error with guidance.

Plugin config shape (getdotenv.config.\* → plugins.dynamodb):

- tablesPath, tokens.{table,entityManager,transform}
- minTableVersionWidth
- generate: { version, tableProperties.{billingMode, readCapacityUnits, writeCapacityUnits, tableName} }
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

Local DynamoDB orchestration (config‑first with embedded fallback)

Commands

- dynamodb local start [--port <n>]
- dynamodb local stop
- dynamodb local status

Behavior and precedence

1. Config‑driven path (preferred when configured)
   - Execute verbatim command strings from plugins.dynamodb.local.\* in get‑dotenv’s composed environment.
   - start waits for readiness before returning.
   - status returns exit code (0 = healthy).
   - stop returns non-zero on failure.

2. Embedded fallback (only when no config command is set)
   - If @karmaniverous/dynamodb-local is installed (optional peer), use setup/teardown/ready helpers.
   - Otherwise, emit guidance and exit non-zero.
