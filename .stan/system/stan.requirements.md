# Entity Manager — Requirements (authoritative)

Scope

- This document specifies the desired end state for entity-manager (vNext). It supersedes prior guidance where conflicts arise and reflects a coordinated, inference-first typing strategy across the “entity-\*” stack.
- It remains provider-agnostic (DynamoDB is a common target) and retains current runtime semantics unless explicitly changed.

Overview

- Entity Manager implements rational indexing and cross-shard querying at scale in your NoSQL database so you can focus on application logic.
- Core responsibilities:
  - Generate and maintain database-facing keys (global hashKey and rangeKey) and other generated properties used by indexes.
  - Encode/decode generated property elements via transcodes.
  - Dehydrate/rehydrate page keys for multi-index, cross-shard paging.
  - Execute provider-agnostic, parallel shard queries through injected shard query functions, combining, de-duplicating, and sorting results.

Key concepts and terminology

- Entity: application data type; accepts unknown keys (record-like).
- Generated properties:
  - Sharded: include the hashKey value and one or more property=value elements; require all elements to be present (atomic), otherwise undefined.
  - Unsharded: one or more property=value elements; missing element values are encoded as empty strings.
- Keys:
  - Global hashKey (shared name across entities) with shard suffix.
  - Global rangeKey (shared name across entities) in the form "uniqueProperty#value".
- Shard bump: a time-windowed rule (timestamp, charBits, chars) defining shard key width and radix for records created within/after that timestamp.
- Index components: tokens defining index hashKey and rangeKey. Tokens may be:
  - Global hashKey or rangeKey.
  - A sharded generated property (hashKey side only).
  - An unsharded generated property or a transcodable scalar property (rangeKey side).

Compatibility and assumptions

- Provider-agnostic orchestration; intended to work over platforms like DynamoDB.
- Canonicalization (e.g., name search fields) is an application concern; Entity Manager treats such strings as opaque values and provides transcodes for ordering/encoding.

Non-requirements (current behavior)

- No automatic fan-out reduction relative to remaining limit in the query loop.
- No enforcement of globally unique (hashKey, rangeKey) pairs across separate index tokens.

---

## Inference-first typing (refactor) — strict acronyms and API requirements

Goals

- Inference-first configuration: callers pass a literal config value; Entity Manager captures tokens and index names directly from the value (no explicit generic parameters required in normal use).
- Token-aware and index-aware typing end-to-end: entity token (ET) and index token (IT/ITS) narrow items, records, page keys, low-level helpers, shard query contracts, and query results without casts.
- Value-first helpers and patterns ensure literal keys are preserved across module boundaries (use "as const" and "satisfies").
- Runtime behavior remains unchanged: Zod-based validation persists; we intersect parsed configuration with captured literal types at the type level.

Zod-schema-first EM inference (no generics at call sites)

- Factory supports optional entitiesSchema: Record<entityToken, Zod schema>.
- When provided, EM is inferred as { [ET]: z.infer<typeof schema[ET]> } directly from values.
- When omitted, EM falls back to a broad EntityMap (no breaking change).
- Schemas define only non-generated properties (base/domain fields). Do not include:
  - global keys (hashKey/rangeKey),
  - generated property tokens (sharded/unsharded keys such as userPK, firstNameRK).
- Item-facing types layer optional key/token strings and base properties over schemas where applicable.
- Record-facing types layer required global keys (hashKey/rangeKey) over schemas for storage-facing shapes.
- Runtime config parsing/validation remains unchanged; entitiesSchema is used for type capture only.

Naming and acronym policy (hard rule)

- Acronyms are reserved for type-parameter names only (e.g., CC, EM, ET, IT, ITS, EOT, EIBT, ERBT as template parameter identifiers).
- Never export abbreviated type aliases. All exported types must be fully named (e.g., EntityOfToken, EntityItemByToken, EntityRecordByToken).

Projection-aware typing (type-only K channel; provider-agnostic)

- Add a type-only "projection" channel K that narrows item shapes when a provider projects a subset of attributes.
  - Helpers:
    - KeysFrom<K>, Projected<T, K>, ProjectedItemByToken<CC, ET, K>.
  - Thread K (default unknown) through:
    - ShardQueryFunction/ShardQueryResult/ShardQueryMap,
    - QueryOptions/QueryResult (and ByCF/ByCC aliases),
    - EntityManager.query,
    - BaseQueryBuilder (getShardQueryFunction, build, query).
- No runtime behavior changes. Projection execution remains an adapter/provider concern.
- Sort typing alignment: QueryOptions.sortOrder is typed over ProjectedItemByToken<CC, ET, K>. Callers should include sort keys in K or adapters should auto-include them at runtime to preserve invariants.

Strict capitalized type-parameter dictionary (type parameters only; no alias exports)

- EM — EntityMap
- E — Entity (single entity shape)
- ET — EntityToken (keys of EM)
- EOT — EntityOfToken (Exactify<EM[ET]>)
- TR — TranscodeRegistry (name → value type)
- TN — TranscodeName (keys of TR)
- CC — CapturedConfig (inference-first config type captured from the literal value)
- HKT — HashKeyToken
- RKT — RangeKeyToken
- SGKT — ShardedGeneratedKeyToken
- UGKT — UnshardedGeneratedKeyToken
- PT — PropertyToken (transcodable scalar property)
- IT — IndexToken (keys of config.indexes)
- ITS — IndexTokenSubset (subset of IT valid for ET in context)
- EIBT — EntityItemByToken (partial EOT + key/generated tokens as strings)
- ERBT — EntityRecordByToken (EIBT + required HKT/RKT)
- PKBI — PageKeyByIndex
- PKMBIS — PageKeyMapByIndexSet
- SQFBI — ShardQueryFunctionByIndex
- QO — QueryOptions
- QR — QueryResult
- PK — PropertyKey (utility)
- V — Value (utility)

Inference-first API and typing (entity-manager)

- Factory (values-first)
  - createEntityManager<const CC extends ConfigInput, EM extends EntityMap = EntitiesFromSchema<CC>>(config: CC, logger?): EntityManager<CC, EM>
  - Behavior:
    - CC is captured from the literal value; callers should prefer "satisfies" for structure checks and "as const" for nested records (indexes, generatedProperties) to preserve literal keys.
    - EM is optional; if entitiesSchema is provided, EM is inferred from the Zod schemas. Otherwise, EM falls back to a broad EntityMap.
    - Zod still validates at runtime; the parsed result is intersected with the captured literal types at the type level (no runtime change).
- Items/records (entity-token aware)
  - EIBT<CC, EM, ET extends keyof EM> — partial EOT with key/generated tokens string-typed.
  - ERBT<CC, EM, ET> — EIBT plus required keys HKT|RKT present as strings.
- Core methods (no explicit generics at call sites; inferred from parameters)
  - addKeys<CC, EM, ET>(entityToken: ET, item: EIBT<CC, EM, ET>, overwrite?): ERBT<CC, EM, ET>
  - removeKeys<CC, EM, ET>(entityToken: ET, item: ERBT<CC, EM, ET>): EIBT<CC, EM, ET>
  - getPrimaryKey<CC, EM, ET>(entityToken: ET, item: EIBT<CC, EM, ET>, overwrite?): EntityKey<CC>[]
- Query (entity + index aware; values-first)
  - Page keys:
    - PKBI<CC, EM, ET, IT> — index-specific page-key object type
    - PKMBIS<CC, EM, ET, ITS> — per-index map of per-hashKey page keys
  - Shard query:
    - SQFBI<CC, EM, ET, IT> = (hashKey: string, pageKey?: PKBI<CC, EM, ET, IT>, pageSize?: number) => Promise<{ count: number; items: EIBT<CC, EM, ET>[]; pageKey?: PKBI<CC, EM, ET, IT> }>
  - Options/results:
    - QO<CC, EM, ET extends keyof EM, ITS extends ITSubsetForEntity<CC, EM, ET>>
    - QR<CC, EM, ET, ITS>
  - query<CC, EM, ET extends keyof EM, ITS extends ITSubsetForEntity<CC, EM, ET>>(options: QO<CC, EM, ET, ITS>): Promise<QR<CC, EM, ET, ITS>>
  - Inference:
    - ET inferred from options.entityToken.
    - ITS inferred from the literal keys of options.shardQueryMap (subset of IT).
    - Optional K (projection) narrows result item shape when provided; defaults to unknown for back-compat.

Configuration model (runtime shape; validated with Zod)

- ParsedConfig (authoritative runtime object) includes:
  - entities: Record<entityToken, { timestampProperty; uniqueProperty; shardBumps?; defaultLimit?; defaultPageSize? }>
  - generatedProperties: { sharded: Record<ShardedKey, string[]>; unsharded: Record<UnshardedKey, string[]> }
  - indexes: Record<indexToken, { hashKey; rangeKey; projections? }>
  - propertyTranscodes: Record<TranscodedProperties, keyof TranscodeRegistry>
  - transcodes: Transcodes<TranscodeRegistry>
  - hashKey, rangeKey; delimiters; throttle

Runtime config validation (selected checks)

- Delimiters must be non-word sequences, not containing each other.
- Keys sets mutually exclusive; types consistent with transcodes.
- Generated elements non-empty, unique, properly transcodable.
- Indexes valid (hash side: global or sharded generated; range side: global range, unsharded generated, or scalar).
- Entities valid; shardBumps sorted, monotonic; defaults injected.

Generated property encoding

- Sharded: "<hashKey>|k#v|k#v…" (atomic; undefined if any element nil).
- Unsharded: "k#v|k#v…" (missing → empty string).
- decodeGeneratedProperty reverses into EIBT patch.

Global key updates

- updateItemHashKey: computes shard suffix based on bump/window; returns updated hashKey.
- updateItemRangeKey: "uniqueProperty#value".
- addKeys/removeKeys/getPrimaryKey implement the expected flows.

Page key map dehydration/rehydration

- dehydratePageKeyMap: stable, typed emission per index/token/hashKey set; strings for compact carry-over.
- rehydratePageKeyMap: validates index set; reconstructs per-hash/per-index typed keys; error on shape mismatch.

Shard space enumeration

- getHashKeySpace enumerates suffixes across shard bumps for a time window; yields properly formed global/alternate hash key values.

Query orchestration

- QO/QR typed; dedupe by uniqueProperty and sort by provided order; rehydrate/dehydrate loop for paging; optional K type-only narrowing.
- Adapter-level projection policy: when projections are supplied, auto-include uniqueProperty and explicit sort keys to preserve dedupe/sort invariants.

Transcodes (entity-tools; canonical names)

- DefaultTranscodeRegistry, defaultTranscodes authored via defineTranscodes; encode/decode agreement at compile time.

Logging and errors

- Injected logger with debug/error; helpers log context and rethrow errors.

Documentation guidance (DX)

- Show “values-first” config patterns using satisfies and as const to preserve literal keys.
- Prefer examples that do not require explicit generic parameters at call sites; demonstrate narrowing via values (entityToken, index tokens).
- Provide concise examples of PageKey typing by index, token-aware add/remove/keys, and value-first factory usage.
- Provide a projection K example with const tuples and document adapter projection policy.

---

## Adapter-level QueryBuilder ergonomics (DynamoDB) — helper methods

Purpose

- Provide small, explicit helpers for common per-index query parameters and projection lifecycle while preserving the type-only K channel invariants in adapters.

Helpers and behavior (adapter-level)

- setScanIndexForward(indexToken: ITS, value: boolean): this
  - Runtime: sets IndexParams.scanIndexForward for the index; getDocumentQueryArgs emits ScanIndexForward.
  - Typing: no effect on K (pure query-direction toggle).

- setProjection<KAttr extends readonly string[]>(indexToken: ITS, attrs: KAttr): QueryBuilder<…, KAttr>
  - Runtime: sets per-index projection attributes; getDocumentQueryArgs emits ProjectionExpression.
  - Query-time invariant: when any projections are present, auto-include uniqueProperty and explicit sort keys to preserve dedupe/sort invariants.
  - Typing: narrows the builder’s K to KAttr (global to the builder; reflects the merged result shape).

- resetProjection(indexToken: ITS): QueryBuilder<…, unknown>
  - Runtime: clears projectionAttributes for the index (no ProjectionExpression ⇒ full items).
  - Typing: widens K back to unknown (result items are no longer uniformly projected).

- resetAllProjections(): QueryBuilder<…, unknown>
  - Runtime: clears projections for all indices on the builder.
  - Typing: widens K to unknown (result items are full shape).

- setProjectionAll<KAttr extends readonly string[]>(indices: ITS[] | readonly ITS[], attrs: KAttr): QueryBuilder<…, KAttr>
  - Runtime: applies the same ProjectionExpression across the supplied indices (or all, if a “current indices” form is later added).
  - Typing: narrows K to KAttr, keeping a uniform projected shape aligned with EntityManager’s merged result semantics.

Notes

- K remains a single, builder-wide type parameter to match merged results across all indices. Uniform projections via setProjectionAll are recommended to keep typing and runtime aligned.
- The adapter’s runtime policy continues to auto-include uniqueProperty and explicit sort keys when projections are present, ensuring stable dedupe/sort.

---

## Internals / variance (typing contract with entity‑manager)

Problem

- Downstream adapters (this repo) extend BaseQueryBuilder with CF/K and sometimes need to call helper functions exported by entity‑manager (e.g., addFilterCondition/addRangeKeyCondition).
- Current helper parameter typing can force downstreams into variance‑bridging casts (unknown as QueryBuilder<C>) even though the helpers only rely on a small structural subset (indexParamsMap, entityClient.logger).

Proposed upstream support (typing-only; no runtime change)

- Relax helper function parameter types to accept a generic builder shape rather than a concrete/bounded one, or accept a minimal structural interface:
  - Structural option: accept any object with indexParamsMap and a logger-like entityClient.
  - BaseQueryBuilder option: generic in BaseQueryBuilder with unconstrained generics (ET/ITS/CF/K) so extensions remain assignable without casts.

Expected outcome

- No runtime changes in entity‑manager.
- Downstream adapters can call helpers without variance casts, improving safety and readability while preserving exact output behavior.

Acceptance criteria

- Updated helper signatures in entity‑manager compile clean and are backward‑compatible.
- This repo removes variance‑bridging casts (unknown as …) on those helper calls after upstream merges.
