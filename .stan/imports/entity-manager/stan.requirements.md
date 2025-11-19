# Entity Manager — Requirements (authoritative)

Scope

- This document specifies the desired end state for entity-manager (vNext). It supersedes prior guidance where conflicts arise and reflects a coordinated, inference-first typing strategy across the “entity-\*” stack.
- It remains provider‑agnostic (DynamoDB is a common target) and retains current runtime semantics unless explicitly changed.

Overview

- Entity Manager implements rational indexing and cross‑shard querying at scale in your NoSQL database so you can focus on application logic.
- Core responsibilities:
  - Generate and maintain database-facing keys (global hashKey and rangeKey) and other generated properties used by indexes.
  - Encode/decode generated property elements via transcodes.
  - Dehydrate/rehydrate page keys for multi-index, cross‑shard paging.
  - Execute provider‑agnostic, parallel shard queries through injected shard query functions, combining, de‑duplicating, and sorting results.

Key concepts and terminology

- Entity: application data type; accepts unknown keys (record‑like).
- Generated properties:
  - Sharded: include the hashKey value and one or more property=value elements; require all elements to be present (atomic), otherwise undefined.
  - Unsharded: one or more property=value elements; missing element values are encoded as empty strings.
- Keys:
  - Global hashKey (shared name across entities) with shard suffix.
  - Global rangeKey (shared name across entities) in the form “uniqueProperty#value”.
- Shard bump: a time‑windowed rule (timestamp, charBits, chars) defining shard key width and radix for records created within/after that timestamp.
- Index components: tokens defining index hashKey and rangeKey. Tokens may be:
  - Global hashKey or rangeKey.
  - A sharded generated property (hashKey side only).
  - An unsharded generated property or a transcodable scalar property (rangeKey side).

Compatibility and assumptions

- Provider‑agnostic orchestration; intended to work over platforms like DynamoDB.
- Canonicalization (e.g., name search fields) is an application concern; Entity Manager treats such strings as opaque values and provides transcodes for ordering/encoding.

Non‑requirements (current behavior)

- No automatic fan‑out reduction relative to remaining limit in the query loop.
- No enforcement of globally unique (hashKey, rangeKey) pairs across separate index tokens.

---

## Inference‑first typing (refactor) — strict acronyms and API requirements

Goals

- Inference‑first configuration: callers pass a literal config value; Entity Manager captures tokens and index names directly from the value (no explicit generic parameters required in normal use).
- Token‑aware and index‑aware typing end‑to‑end: entity token (ET) and index token (IT/ITS) narrow items, records, page keys, low‑level helpers, shard query contracts, and query results without casts.
- Value‑first helpers and patterns ensure literal keys are preserved across module boundaries (use “as const” and “satisfies”).
- Runtime behavior remains unchanged: Zod‑based validation persists; we intersect parsed configuration with captured literal types at the type level.

Zod‑schema‑first EM inference (no generics at call sites)

- Factory supports optional entitiesSchema: Record<entityToken, Zod schema>.
- When provided, EM is inferred as { [ET]: z.infer<typeof schema[ET]> } directly from values.
- When omitted, EM falls back to a broad EntityMap (no breaking change).
- Schemas define only non‑generated properties (base/domain fields). Do not include:
  - global keys (hashKey/rangeKey),
  - generated property tokens (sharded/unsharded keys such as userPK, firstNameRK).
- Item‑facing types layer optional key/token strings and base properties over schemas where applicable.
- Record‑facing types layer required global keys (hashKey/rangeKey) over schemas for storage‑facing shapes.
- Runtime config parsing/validation remains unchanged; entitiesSchema is used for type capture only.

Naming and acronym policy (hard rule)

- Acronyms are reserved for type‑parameter names only (e.g., CC, EM, ET, IT, ITS, EOT, EIBT, ERBT as template parameter identifiers).
- Never export abbreviated type aliases. All exported types must be fully named (e.g., EntityOfToken, EntityItemByToken, EntityRecordByToken).

Projection‑aware typing (type‑only K channel; provider‑agnostic)

- Add a type‑only “projection” channel K that narrows item shapes when a provider projects a subset of attributes.
  - Helpers:
    - KeysFrom<K>, Projected<T, K>, ProjectedItemByToken<CC, ET, K>.
  - Thread K (default unknown) through:
    - ShardQueryFunction/ShardQueryResult/ShardQueryMap,
    - QueryOptions/QueryResult (and ByCF/ByCC aliases),
    - EntityManager.query,
    - BaseQueryBuilder (getShardQueryFunction, build, query).
- No runtime behavior changes. Projection execution remains an adapter/provider concern.
- Sort typing alignment: QueryOptions.sortOrder is typed over ProjectedItemByToken<CC, ET, K>. Callers should include sort keys in K or adapters should auto‑include them at runtime to preserve invariants.

Strict capitalized type‑parameter dictionary (type parameters only; no alias exports)

- EM — EntityMap
- E — Entity (single entity shape)
- ET — EntityToken (keys of EM)
- EOT — EntityOfToken (Exactify<EM[ET]>)
- TR — TranscodeRegistry (name → value type)
- TN — TranscodeName (keys of TR)
- CC — CapturedConfig (inference‑first config type captured from the literal value)
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

Type‑parameter ordering (public APIs)

1. CC (when config‑derived tokens are needed)
2. EM
3. TR (and TN only if necessary)
4. ET (and EOT only if necessary)
5. IT / ITS
6. PK / V (utility generics last)

Inference‑first API and typing (entity‑manager)

- Factory (values‑first)
  - createEntityManager<const CC extends ConfigInput, EM extends EntityMap = EntitiesFromSchema<CC>>(config: CC, logger?): EntityManager<CC, EM>
  - Behavior:
    - CC is captured from the literal value; callers should prefer “satisfies” for structure checks and “as const” for nested records (indexes, generatedProperties) to preserve literal keys.
    - EM is optional; if entitiesSchema is provided, EM is inferred from the Zod schemas. Otherwise, EM falls back to a broad EntityMap.
    - Zod still validates at runtime; the parsed result is intersected with the captured literal types at the type level (no runtime change).
- Items/records (entity‑token aware)
  - EIBT<CC, EM, ET extends keyof EM> — partial EOT with key/generated tokens string‑typed.
  - ERBT<CC, EM, ET> — EIBT plus required keys HKT|RKT present as strings.
- Core methods (no explicit generics at call sites; inferred from parameters)
  - addKeys<CC, EM, ET>(entityToken: ET, item: EIBT<CC, EM, ET>, overwrite?): ERBT<CC, EM, ET>
  - removeKeys<CC, EM, ET>(entityToken: ET, item: ERBT<CC, EM, ET>): EIBT<CC, EM, ET>
  - getPrimaryKey<CC, EM, ET>(entityToken: ET, item: EIBT<CC, EM, ET>, overwrite?): Array<Record<HKT<CC> | RKT<CC>, string>>
- Query (entity + index aware; values‑first)
  - Page keys:
    - PKBI<CC, EM, ET, IT> — index‑specific page‑key object type
    - PKMBIS<CC, EM, ET, ITS> — per‑index map of per‑hashKey page keys
  - Shard query:
    - SQFBI<CC, EM, ET, IT> = (hashKey: string, pageKey?: PKBI<CC, EM, ET, IT>, pageSize?: number) => Promise<{ count: number; items: EIBT<CC, EM, ET>[]; pageKey?: PKBI<CC, EM, ET, IT> }>
  - Options/results:
    - QO<CC, EM, ET extends keyof EM, ITS extends ITSubsetForEntity<CC, EM, ET>>
    - QR<CC, EM, ET, ITS>
  - query<CC, EM, ET extends keyof EM, ITS extends ITSubsetForEntity<CC, EM, ET>>(em: EntityManager<CC, EM>, options: QO<CC, EM, ET, ITS>): Promise<QR<CC, EM, ET, ITS>>
  - Inference:
    - ET inferred from options.entityToken.
    - ITS inferred from the literal keys of options.shardQueryMap (subset of IT).
    - Optional K (projection) narrows result item shape when provided; defaults to unknown for back‑compat.
- BaseQueryBuilder (adapters) carries ET/ITS/CF/K
  - getShardQueryFunction(indexToken): ShardQueryFunction<…, CF, K>
  - build(): ShardQueryMap<…, CF, K>
  - query(): forwards K to EntityManager.query<…, CF, K>
- Low‑level helpers (thread ET/IT; inference‑first)
  - getIndexComponents<CC, EM, ET, IT>(…): Array<HKT<CC> | RKT<CC> | SGKT<CC> | UGKT<CC> | PT>
  - unwrapIndex<CC, EM, ET, IT>(…): Array<PT>
  - encodeElement<CC, EM, ET>(…): string | undefined
  - decodeElement<CC, EM, ET>(…): EIBT<CC, EM, ET>[PK]
  - dehydrateIndexItem<CC, EM, ET, IT>(…): string
  - rehydrateIndexItem<CC, EM, ET, IT>(…): EIBT<CC, EM, ET>
  - dehydratePageKeyMap<CC, EM, ET, ITS>(…): string[]
  - rehydratePageKeyMap<CC, EM, ET, ITS>(…): [HKT<CC>, PKMBIS<CC, EM, ET, ITS>]
  - decodeGeneratedProperty<CC, EM, ET>(entityManager, entityToken: ET, encoded: string): EntityItemByToken<CC, EM, ET>
    - Note: entityToken is required (no backward‑compat constraint).
- IndexTokenByEntity
  - Computed from CC (and optionally EM) using config semantics:
    - Hash side: global HKT → all entities; sharded generated hashKey → E must contain all elements of the sharded generated property.
    - Range side:
      - RKT → E must have uniqueProperty.
      - Unsharded generated range → E must contain its elements.
      - Scalar PT → E must have that property and it must be mapped in propertyTranscodes.

DX guidance (values‑first patterns)

- Prefer “as const” and “satisfies” for config structures (especially indexes, generatedProperties).
- Avoid early broad annotation of the whole config object; pass the literal to createEntityManager so CC is captured from values.
- Degrade gracefully: if keys widen due to dynamic spreads, types still work; users can opt back into full inference by applying the patterns above.

---

## Configuration model (runtime shape; validated with Zod)

ParsedConfig (authoritative runtime object)

- entities: Record<entityToken, {
  timestampProperty: TranscodedProperties;
  uniqueProperty: TranscodedProperties;
  shardBumps?: ShardBump[];
  defaultLimit?: number (default 10);
  defaultPageSize?: number (default 10);
  }>
- generatedProperties:
  - sharded: Record<ShardedKey, TranscodedProperties[]>
  - unsharded: Record<UnshardedKey, TranscodedProperties[]>
- indexes: Record<indexToken, {
  hashKey: HashKey | ShardedKey;
  rangeKey: RangeKey | UnshardedKey | TranscodedProperties;
  projections?: string[]; // unique; must not include keys
  }>
- propertyTranscodes: Record<TranscodedProperties, keyof TranscodeRegistry>
- transcodes: Transcodes<TranscodeRegistry> (defaults to defaultTranscodes)
- hashKey: HashKey
- rangeKey: RangeKey
- generatedKeyDelimiter: string (default '|', must match /\W+/)
- generatedValueDelimiter: string (default '#', must match /\W+/)
- shardKeyDelimiter: string (default '!', must match /\W+/)
- throttle: number (default 10)

Runtime config validation (selected checks)

- Delimiters:
  - Each delimiter must match /\W+/.
  - No delimiter may contain another (check both directions for generatedKeyDelimiter, generatedValueDelimiter, shardKeyDelimiter).
- Key exclusivity:
  - hashKey must not collide with rangeKey, sharded/unsharded generated keys, or transcoded properties.
  - rangeKey must not collide with sharded/unsharded generated keys or transcoded properties.
  - sharded and unsharded generated keys must be mutually exclusive; neither may collide with transcoded properties.
- propertyTranscodes:
  - Values must be valid transcode names present in transcodes.
- Generated property elements:
  - All elements listed under sharded/unsharded must be covered by propertyTranscodes (i.e., are transcodable properties).
  - Arrays must be non‑empty and must not contain duplicates.
- Indexes:
  - hashKey must be either the global hashKey or a sharded generated property.
  - rangeKey must be one of: global rangeKey, an unsharded generated property, or a transcodable scalar property.
  - projections (if present) must be unique; must not include any key (global hash/range, index hash/range, sharded/unsharded).
- Entities:
  - timestampProperty and uniqueProperty must be TranscodedProperties.
  - shardBumps:
    - Each bump is { timestamp: int >=0, charBits: int in [1..5], chars: int in [0..40] }.
    - Bumps are sorted by timestamp ascending; a zero‑timestamp bump { charBits: 1, chars: 0 } is ensured (prepended if missing).
    - chars must increase monotonically with timestamp (strictly).

---

## Generated property encoding

- encodeGeneratedProperty(entityManager, propertyToken, item):
  - propertyToken must be defined under generatedProperties.sharded or .unsharded.
  - Sharded behavior (atomic):
    - If any element is null/undefined, result is undefined (atomicity).
    - Output format: “<hashKey>|k#v|k#v...” where <hashKey> is the item’s current global hashKey value.
  - Unsharded behavior (not atomic):
    - Missing element values are rendered as empty strings.
    - Output format: “k#v|k#v...”
  - Elements are encoded using generatedValueDelimiter ('#') and joined by generatedKeyDelimiter ('|').

- decodeGeneratedProperty(entityManager, entityToken, encoded):
  - Parses sharded vs unsharded form; rebuilds an EIBT patch:
    - If first segment contains shardKeyDelimiter, it is interpreted as the global hashKey.
    - Each “k#v” pair is decoded back to the original property types via decodeElement.
  - Throws on malformed pairs (missing or repeated value delimiters).

---

## Global key updates

- updateItemHashKey(entityManager, entityToken, item, overwrite=false):
  - Computes hashKey suffix based on the shard bump applicable to the entity’s timestampProperty:
    - Determine bump by timestamp; compute radix = 2\*\*charBits.
    - Compute space = radix\*\*chars (full shard space).
    - Compute suffix = (stringHash(uniquePropertyValue) % space).toString(radix).padStart(chars, '0').
    - Prefix = entityToken + shardKeyDelimiter; final hashKey = prefix + suffix.
    - If chars == 0, suffix is empty (unsharded: “<entity>!”).
  - If hashKey exists and overwrite=false, returns a shallow copy without changes.
  - Validates presence of timestampProperty and uniqueProperty.

- updateItemRangeKey(entityManager, entityToken, item, overwrite=false):
  - Sets the global rangeKey to “<uniqueProperty>#<value>” using generatedValueDelimiter.
  - If rangeKey exists and overwrite=false, returns a shallow copy without changes.

- addKeys(entityManager, entityToken, item, overwrite=false):
  - Validates entityToken; updates hashKey, then rangeKey, then all generatedProperties (sharded and unsharded) based on overwrite rules.
  - Returns an EntityRecord (i.e., EntityItem with required hashKey and rangeKey present).

- removeKeys(entityManager, entityToken, item):
  - Returns a shallow clone with global keys and generatedProperties removed (hashKey, rangeKey, and all generated property tokens).

- getPrimaryKey(entityManager, entityToken, item, overwrite=false):
  - Returns an array of keys. If both keys are present and overwrite=false, returns exactly that pair.
  - Otherwise:
    - Computes the range key.
    - If timestampProperty is present, computes exactly one hashKey and returns a single pair.
    - If timestampProperty is missing but uniqueProperty is present, enumerates the hash‑key space across all shard bumps and returns one key per applicable bump (deduped).

---

## Page key map dehydration/rehydration

- dehydratePageKeyMap(entityManager, entityToken, pageKeyMap):
  - Validates entityToken; if pageKeyMap is empty, returns [].
  - Sorts indexTokens and enumerates hashKey values from the first index; for each (index, hashKey):
    - If undefined → emits '' (empty string).
    - Else → composes an item from the pageKey:
      - Decodes any encoded generated keys into item fields.
      - Refreshes rangeKey via updateItemRangeKey.
      - Dehydrates the per‑index fragment via dehydrateIndexItem (string).
  - If all entries are '', returns [].

- rehydratePageKeyMap(entityManager, entityToken, indexTokens, item, dehydrated, timestampFrom=0, timestampTo=Date.now()):
  - Validates entityToken and non‑empty indexTokens; validates all tokens exist and share the same hashKey token; returns [hashKeyToken, PKMBIS].
  - Enumerates hash key space for [timestampFrom, timestampTo] via getHashKeySpace.
  - If dehydrated is undefined → returns a PKMBIS with all hashKeys mapped to undefined for each index token.
  - Else → validates dehydrated length equals (indexTokens.length \* hashKeySpace.length); clusters strings by index, aligns by hashKey; for non‑empty entries:
    - Decodes hashKey into item fields (if sharded).
    - Rehydrates index fragment via rehydrateIndexItem.
    - Sets rangeKey string to “<uniqueProperty>#<value>”.
    - Encodes any generated properties used in page keys.

---

## Shard space enumeration

- getHashKeySpace(entityManager, entityToken, hashKeyToken, item, timestampFrom=0, timestampTo=Date.now()):
  - hashKeyToken must be either the global hashKey or a sharded generated property.
  - For each shard bump that overlaps [timestampFrom, timestampTo]:
    - Compute radix = 2**charBits and enumerate shard keys for chars ('' if chars=0 else 0..(radix**chars - 1), base=radix, padded to chars).
  - Global hashKey variant → “<entityToken>!<suffix>”.
  - Sharded generated hashKey variant → encodeGeneratedProperty(hashKeyToken, { …item, [hashKey]: “<entityToken>!<suffix>” }).
  - Throws if item lacks elements required to encode a sharded alternate hash key.

---

## Query orchestration

- QO<CC, EM, ET, ITS>
  - entityToken: ET
  - item: EIBT<CC, EM, ET> (sufficient to generate alternate hash keys as needed).
  - shardQueryMap: Partial<Record<ITS, SQFBI<CC, EM, ET, ITS>>>
  - pageKeyMap?: string — compressed dehydrated page key array from prior query iteration.
  - limit?: number — target maximum total records across all shards; positive integer or Infinity; default = entity defaultLimit.
  - pageSize?: number — max records per individual shard query; positive integer; default = entity defaultPageSize.
  - sortOrder?: SortOrder<EIBT<CC, EM, ET>> — progressive sort order; defaults to [].
  - timestampFrom?: number, timestampTo?: number — shard window; defaults 0..Date.now().
  - throttle?: number — max number of shard queries in parallel; default = config.throttle.

- QR<CC, EM, ET, ITS>
  - count: number
  - items: EIBT<CC, EM, ET>[]
  - pageKeyMap: string

- Behavior (unchanged semantics)
  - Rehydrate pageKeyMap (or initialize with undefined) over the index set and enumerated shard keys for the window.
  - If the map is empty, return { count: 0, items: [], pageKeyMap: compressed '[]' }.
  - Iterate:
    - Execute shardQueryFunction in parallel for every (indexToken, hashKey) with pageKey !== undefined, up to throttle concurrency.
    - Update in‑memory pageKeyMap with each returned pageKey.
    - Accumulate items; repeat while any pageKey remains defined and item count < limit.
  - De‑duplicate by uniqueProperty and sort by sortOrder.
  - Dehydrate, compress, and return.
  - Projection channel K (type‑only):
    - Narrows result item shape to Pick<EIBT<CC, EM, ET>, KeysFrom<K>>.
    - Does not alter runtime behavior; adapters/providers execute projections and may auto‑include uniqueProperty and any sortOrder keys to preserve dedupe/sort invariants.
    - QueryOptions.sortOrder is typed over the projected shape; include used keys in K or auto‑include at the adapter.

---

## Transcodes (entity‑tools; canonical names)

- Registry naming
  - TranscodeRegistry is canonical (replaces TranscodeMap).
  - DefaultTranscodeRegistry is canonical (replaces DefaultTranscodeMap).
  - defaultTranscodes: Transcodes<DefaultTranscodeRegistry>.
- defineTranscodes (entity‑tools)
  - Value‑first builder; infers registry from decode() return types; enforces encode/decode agreement at compile time.
- Selection helpers (entity‑tools)
  - TranscodableProperties<O, TR>, UntranscodableProperties<O, TR> operate precisely on scalar properties whose types are covered by TR.

---

## Logging and errors

- Entity Manager accepts an injected logger implementing { debug, error } (console by default).
- All helpers log debug context and error detail; errors are rethrown.

---

## Documentation guidance (DX)

- Show “values‑first” config patterns using satisfies and as const to preserve literal keys for indexes and generatedProperties.
- Prefer examples that do not require explicit generic parameters at call sites; demonstrate narrowing via values (entityToken, index tokens).
- Provide concise examples of PageKey typing by index, token‑aware add/remove/keys, and value‑first factory usage.
- Add a brief example of projection‑aware typing:
  - Attributes as const tuples (K) narrow item shapes.
  - Note that sort keys and uniqueProperty should be included in K or automatically included by adapters.

---

## Adapter‑level QueryBuilder ergonomics (downstream guidance)

Purpose

- Provide small, explicit helpers for common per‑index query parameters and projection lifecycle while preserving the type‑only K channel invariants in adapters (e.g., @karmaniverous/entity-client-dynamodb).

Helpers and behavior (adapter‑level; implemented downstream)

- setScanIndexForward(indexToken: ITS, value: boolean): this
  - Runtime: sets IndexParams.scanIndexForward for the index; getDocumentQueryArgs emits ScanIndexForward.
  - Typing: no effect on K (pure query‑direction toggle).
- setProjection<KAttr extends readonly string[]>(indexToken: ITS, attrs: KAttr): QueryBuilder<…, KAttr>
  - Runtime: sets per‑index projection attributes; getDocumentQueryArgs emits ProjectionExpression.
  - Query‑time invariant: when any projections are present, auto‑include uniqueProperty and explicit sort keys to preserve dedupe/sort invariants.
  - Typing: narrows the builder’s K to KAttr (global to the builder; reflects the merged result shape).
- resetProjection(indexToken: ITS): QueryBuilder<…, unknown>
  - Runtime: clears projectionAttributes for the index (no ProjectionExpression ⇒ full items).
  - Typing: widens K back to unknown (result items are no longer uniformly projected).
- resetAllProjections(): QueryBuilder<…, unknown>
  - Runtime: clears projections for all indices on the builder.
  - Typing: widens K to unknown (result items are full shape).
- setProjectionAll<KAttr extends readonly string[]>(indices: ITS[] | readonly ITS[], attrs: KAttr): QueryBuilder<…, KAttr>
  - Runtime: applies the same ProjectionExpression across the supplied indices (or all, if a “current indices” form is later added).
  - Typing: narrows builder K to KAttr, keeping a uniform projected shape aligned with Entity Manager’s merged result semantics.

Notes

- K remains a single, builder‑wide type parameter to match merged results across all indices. Uniform projections via setProjectionAll are recommended to keep typing and runtime aligned.
- Adapter runtime policy should auto‑include uniqueProperty and explicit sort keys when projections are present, ensuring stable dedupe/sort.

---

## Helper typing for downstream QueryBuilder‑based adapters (typing contract)

Context

- Downstream adapters (e.g., @karmaniverous/entity-client-dynamodb) extend BaseQueryBuilder with additional generics (e.g., CF for page‑key narrowing and K for projection) and may define adapter‑specific helpers (e.g., addFilterCondition, addRangeKeyCondition).
- Helper parameter typing that requires a concrete builder type can force variance‑bridging casts at call sites even though helpers typically rely on a small mutable subset (indexParamsMap, entityClient.logger).

Guidance — accept generic BaseQueryBuilder instantiations (typing‑only; no runtime change)

- Downstream helper parameter types should accept any BaseQueryBuilder instantiation (regardless of its generics ET/ITS/CF/K) and intersect the mutable shape helpers actually use.
- Keep behavior unchanged; this is a type improvement that removes downstream casts while preserving type inference for indexToken (ITS).

Canonical signatures (conceptual; implemented downstream)

```ts
import type {
  BaseConfigMap,
  BaseEntityClient,
  BaseQueryBuilder,
  EntityToken,
} from '@karmaniverous/entity-manager';

// IndexParams is the adapter's per-index state mutated by helpers.

export function addRangeKeyCondition<
  CC extends BaseConfigMap,
  Client extends BaseEntityClient<CC>,
  ET extends EntityToken<CC>,
  ITS extends string,
  CF = unknown,
  K = unknown,
>(
  builder: BaseQueryBuilder<CC, Client, unknown, ET, ITS, CF, K> & {
    indexParamsMap: Record<ITS, IndexParams>;
    entityClient: { logger: Pick<Console, 'debug' | 'error'> };
  },
  indexToken: ITS,
  condition: RangeKeyCondition,
): void;

export function addFilterCondition<
  CC extends BaseConfigMap,
  Client extends BaseEntityClient<CC>,
  ET extends EntityToken<CC>,
  ITS extends string,
  CF = unknown,
  K = unknown,
>(
  builder: BaseQueryBuilder<CC, Client, unknown, ET, ITS, CF, K> & {
    indexParamsMap: Record<ITS, IndexParams>;
    entityClient: { logger: Pick<Console, 'debug' | 'error'> };
  },
  indexToken: ITS,
  condition: FilterCondition<CC>,
): void;
```

Details and rationale

- Intersection expresses the precise mutable contract (indexParamsMap and logger) while keeping a strong semantic tie to BaseQueryBuilder.
- ITS flows from the builder into indexToken, maintaining helpful key narrowing at call sites.
- Zero runtime changes — only typing is widened to be variance‑friendly.

Scope and callout

- This section is guidance for downstream adapter implementations (e.g., @karmaniverous/entity-client-dynamodb). Entity Manager already exports the generic BaseQueryBuilder surface required by this approach; helper definitions and call sites reside in the adapter repos.
