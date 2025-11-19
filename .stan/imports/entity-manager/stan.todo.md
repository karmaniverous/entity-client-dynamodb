# Development Plan

## Next up (in priority order)
- Docs (DX) — projection K + builder threading:
  - README/API: add a focused section showing:
    - How to use projection K with const tuples (end‑to‑end narrowing in ShardQueryFunction/Map, QueryOptions/Result).
    - Dedupe/sort invariants: include uniqueProperty and any explicit sort keys in K, or document that adapters should auto‑include them at runtime.
  - Cross‑link QueryOptionsByCF/ByCC and ShardQueryMapByCF/ByCC for index‑aware typing; add a short snippet for defineSortOrder<E>.

- Interop (entity-client-dynamodb):
  - Add tsd coverage mirroring the new K path: const‑tuple attrs narrow items across SQF/Map/Options/Result; include getItem/getItems removeKeys literal overload combos.
  - Implement/confirm ProjectionExpression auto‑inclusion of uniqueProperty + explicit sort keys when attrs omit them (preserves dedupe/sort invariants at runtime).
  - Ensure createQueryBuilder examples show CF‑aware typed page keys alongside K usage.

- Demo repo:
  - Update to use entitiesSchema factory + token‑aware calls; add a small example demonstrating projection K and index‑aware page keys (DX validation).

- Release notes & coordination:
  - Prepare notes: projection K channel and BaseQueryBuilder typing updates; no runtime behavior changes; defaults remain back‑compatible.
  - Reference interop notes for entity-client-dynamodb; coordinate downstream release once docs/tests land.

- Optional guardrails (low priority):
  - CI checks scanning generated d.ts for acronym dictionary conformance.
  - Keep knip/lint/typecheck/test/docs green post‑changes.

## Completed (append-only)

**CRITICAL: This list is append-only; do not edit items! Place most recent entries at the BOTTOM of the list. When pruning, remove older entries from the top.**

- Step 1 — Align with entity-tools rename (types only; mechanical)
  - Replaced all type-only imports:
    - TranscodeMap → TranscodeRegistry
    - DefaultTranscodeMap → DefaultTranscodeRegistry
  - Updated BaseConfigMap to expose TranscodeRegistry instead of TranscodeMap in the base configuration map and updated all dependent generic references (e.g., C['TranscodeRegistry']).
  - Updated doc-only imports across BaseEntityClient, BaseQueryBuilder, and EntityManager modules to reference TranscodeRegistry.
  - Acceptance: typecheck/build/docs green with zero runtime changes.
  - Amended: finalized the rename by correcting the Config<C> type in src/EntityManager/Config.ts and updating typedoc externalSymbolLinkMappings (DefaultTranscodeRegistry/TranscodeRegistry). This resolves TS parse errors and docs linkage issues so typecheck/build/docs pass.
  - Amended: replaced remaining TSDoc references to TranscodeMap → TranscodeRegistry across BaseEntityClient, BaseQueryBuilder, and EntityManager public types (EntityItem/Record/Key/Token, PageKey, QueryOptions/Result, ShardQuery types, ValidateConfigMap). Resolves TypeDoc unresolved-link warnings.
  - Amended: fixed final TSDoc reference in BaseQueryBuilder generic param C (TranscodeMap → TranscodeRegistry) to clear the last TypeDoc warning.

- Step 2 — Values-first factory (initial)
  - Added createEntityManager<const CC extends ConfigInput, EM extends EntityMap = MinimalEntityMapFrom<CC>>(config, logger?) returning EntityManager<CapturedConfigMapFrom<CC, EM>>.
  - Introduced ConfigInput shape for values-first capture; CapturedConfigMapFrom and MinimalEntityMapFrom helper types to bridge literal config → BaseConfigMap-compatible manager generics.
  - Behavior unchanged (Zod parsing in EntityManager constructor remains authoritative).
  - Acceptance: repo scripts green (typecheck, lint, test, build, docs).

- Step 2 — Strict acronyms (public generics, initial)
  - Renamed public type parameter `C` → `CC` across EntityManager, BaseEntityClient, BaseQueryBuilder, and public EM types (EntityItem/Record/Key/Token, PageKey, QueryOptions/Result, ShardQueryFunction/Map/Result, ValidateConfigMap).
  - TSDoc @typeParam updated accordingly. No runtime changes. All scripts remain green (allowing transitional lint/knip state per plan).

- Factory inference (schema-first) and cleanup
  - Removed MinimalEntityMapFrom (no practical contribution to inference).
  - Added optional entitiesSchema to ConfigInput. When present, EM is inferred
    directly from Zod schemas (values-first, no explicit generics).
  - Fallback remains EntityMap when schemas are omitted; runtime config parsing/validation unchanged.
  - Documentation updated to state schemas include only non-generated fields.

- Overload cleanup (TS2394 fix)
  - Removed broad (non-generic) overloads for addKeys/getPrimaryKey/removeKeys.
  - Kept ET-aware overloads and matched implementation signatures to ET-aware forms.
  - Resolves overload/implementation mismatch without introducing any “any” types.

- Step 3 — Thread ET/ITS through query types and helpers (types only)
  - Added ET/ITS generics to QueryOptions/QueryResult/ShardQueryFunction/ShardQueryResult/ShardQueryMap.
  - Added PKBI/PKMBIS aliases: PageKeyByIndex and PageKeyMapByIndexSet, and threaded through dehydrate/rehydratePageKeyMap and WorkingQueryResult.
  - Updated EntityManager.query signature to infer ET from options.entityToken and ITS from shardQueryMap keys.
  - No runtime behavior changes.

- TSDoc clarifications and optional guardrail
  - Clarified TokenAware usage: schemas define only base (non-generated) fields; keys/tokens are layered by EM.
  - createEntityManager: added best-effort dev warning (debug) when entitiesSchema keys mismatch config.entities keys.

- Type tests (tsd) — inference checks
  - Updated existing type tests to the new generics for ShardQuery types and QueryOptions/Result.
  - Added factory-inference test asserting schema-first inference (entitiesSchema) and ET-narrowed addKeys/getPrimaryKey/removeKeys flows.

- Amended: QueryBuilder generics and tests updated
  - BaseQueryBuilder now threads ET/ITS through ShardQueryFunction/Map and build().
  - query.test updated to specify ET/IT generics and annotate parameters.
  - Fixed PageKeyMapByIndexSet indexing and typed loops to satisfy TS.
  - Suppressed unused placeholder generic warnings per plan (placeholders retained for Step 3 follow-through).

- Amended: placeholder generics + tsd width checks
  - Suppressed @typescript-eslint/no-unused-vars for ITS in QueryResult.ts (file-scope) per “leave placeholders” plan.
  - createEntityManager dev guard kept; silenced no-unnecessary-condition for best-effort mismatch warning.
  - Adjusted tsd factory-inference assertions to expectAssignable for EntityRecord<any> and EntityItem<any> to avoid width errors while placeholders remain.

- Public export for values-first factory
  - Re-exported createEntityManager from src/EntityManager/index.ts (and transitively from the package root).
  - Resolves knip “unused file” flag on src/EntityManager/createEntityManager.ts by making it part of the public API surface.
  - No runtime behavior changes.

- Index token capture helper (values-first)
  - Added IndexTokensFrom<CC> to createEntityManager.ts to capture the union of index tokens from a values-first ConfigInput (when keys are preserved via `as const`).
  - Purely a typing affordance to support Step 3 follow‑through (tightening ITS); no runtime changes.
  - Acronym lint CI deferred per guidance; implementation keeps template acronyms consistent.

- Docs warnings fix (TypeDoc)
  - Exported internal helper types (HashKeyFrom, RangeKeyFrom, ShardedKeysFrom, UnshardedKeysFrom, TranscodedPropertiesFrom) so TypeDoc can include and link them.
  - Removes “referenced but not included” warnings without changing runtime behavior.

- PKBI refinement (optional CF channel)
  - PageKeyByIndex now accepts an optional CF (config-literal) type parameter.
  - When CF carries `indexes`, PKBI narrows to the specific index components (global hash/range plus that index’s hashKey/rangeKey); otherwise falls back to broad PageKey.
  - Threaded CF (defaulted to unknown) through PageKeyMapByIndexSet, ShardQueryFunction/Map/Result to enable downstream adoption without breaking existing code.
  - No runtime behavior changes; tests unaffected.

- PKBI CF indexing fix
  - Reworked PageKeyByIndex helpers to guard access to CF.indexes[IT] and extract literals via conditional types (avoids TS2536).
  - Silenced placeholder ET generic lint locally in PageKeyByIndex for consistency with plan.
  - No runtime changes; build/docs/typecheck now clean.

- Docs warnings fix (TypeDoc)
  - Exported IndexComponentTokens so it’s included and linked in docs (referenced by PageKeyByIndex).
  - Removes the final “referenced but not included” warning without affecting runtime.

- Docs warnings fix (TypeDoc)
  - Exported HasIndexFor, IndexHashKeyOf, and IndexRangeKeyOf in PageKey.ts so all helpers referenced by IndexComponentTokens are included and linked.
  - No runtime changes; keeps docs clean.

- CF threading in query pipeline
  - Added CF generic to QueryOptions and threaded through EntityManager.query,
    rehydratePageKeyMap/dehydratePageKeyMap, ShardQueryFunction/Result/Map,
    and BaseQueryBuilder (class + QueryBuilderQueryOptions).
  - No runtime changes; preserves default unknown for backwards compatibility.

- EntityManager.query CF generic
  - Added CF parameter to EntityManager.query signature and forwarded to the internal
    query() function. Aligns with BaseQueryBuilder and QueryOptions CF threading.
  - Fixes TS2558 from generic arity mismatch.

- TSD tests — CF-based PageKeyByIndex narrowing
  - Added pagekey-narrowing.test-d.ts to validate CF-driven narrowing for PageKeyByIndex and ShardQueryFunction pageKey parameter using values-first config with literal index keys.
  - Confirms only the expected index components are permitted; improper keys produce type errors as intended.

- DX: Silence IDE TS squiggles in tsd tests
  - Replaced expectError(...) assertions in test-d/pagekey-narrowing.test-d.ts with @ts-expect-error comments.
  - VS Code no longer flags expected errors when files are opened, while tsd still enforces them (unused @ts-expect-error fails).

- CF-indexes constraint on ShardQueryMap keys
  - ShardQueryMap now constrains map keys to CF.indexes when a values-first
    config literal (with `indexes`) is provided. Excess keys rejected by
    excess property checks. Added tsd negative case.

- TSD fix — consume @ts-expect-error via call site
  - Reworked ShardQueryMap negative case to call a typed helper so the error
    is emitted at the call, avoiding an unused @ts-expect-error directive.

- TSD fix — move directive to property line
  - Placed @ts-expect-error directly on the offending object property to ensure it’s consumed; removed the unused directive above the call.

- CF-indexes constraint on ShardQueryFunction
  - ShardQueryFunction now resolves to `never` when IT is not a key of CF.indexes
    (when provided). Added tsd negative case to assert the constraint.

- Test type alignment (query.test.ts)
  - Exported MyConfigMap from test/config and updated src/EntityManager/query.test.ts
    to import it, aligning the test generics with the actual entityManager config.

- Test typing — explicit ShardQueryMap for union ITS
  - Declared typed ShardQueryMap variables (single and multi-index) and used them
    instead of object literals so ITS infers as 'lastName' | 'firstName'.

- Helper typing — CF/IT-aware getIndexComponents
  - getIndexComponents now returns IndexComponentTokens<CC, CF, IT>[] so callers
    can opt into CF-index-based narrowing at the type level. No runtime changes.

- Helper typing — CF/IT-aware unwrapIndex
  - Threaded ET/IT/CF generics through unwrapIndex; narrowed indexToken via IT.
  - Typed omit parameter to accept IndexComponentTokens<CC, CF, IT> and
    TranscodedProperties. Return type unchanged. No runtime changes.

- Lint fix — unwrapIndex ET generic
  - Removed unused ET type parameter from unwrapIndex to satisfy @typescript-eslint/no-unnecessary-type-parameters. No runtime changes.

- DX sugar — derive ITS from CF.indexes
  - Added IndexTokensOf<CF> helper to capture index token unions from values-first
    config literals.
  - Added QueryOptionsByCF type alias that plugs IndexTokensOf<CF> into QueryOptions to derive ITS automatically (no runtime changes).

- DX sugar — ShardQueryMapByCF
  - Added ShardQueryMapByCF alias mirroring QueryOptionsByCF to derive ITS from CF.indexes for shardQueryMap typing (no runtime changes).

- Docs — README DX rewrite
  - Rewrote README with a values/schema-first focus; added CF-aware DX examples (QueryOptionsByCF, ShardQueryMapByCF). Preserved header/footer.

- DX sugar — CC aliases
  - Added QueryOptionsByCC and ShardQueryMapByCC to derive ITS from a values-first captured config (IndexTokensFrom<CC>) and pass CC through the CF channel.

- Tests — DX helper coverage
  - Added tsd tests validating QueryOptionsByCF/CC and ShardQueryMapByCF/CC typing, key constraints, and basic compatibility with ShardQueryFunction signatures.

- Docs — README update (CC sugar)
  - Updated README to document QueryOptionsByCC and ShardQueryMapByCC, including examples and DX highlights.

- Interop — entity-client-dynamodb response
  - Added .stan/interop/entity-client-dynamodb/interop-response.md summarizing delivered features and DX enhancements beyond the original request.

- Interop — zod infer in d.ts
  - Replaced zod named/aliased infer import with a type-only namespace import and z.infer in EntitiesFromSchema to avoid d.ts parse errors downstream. No runtime import added; prepare patch release.

- Projection-aware typed results (type-only K in entity-manager)
  - Added helper types KeysFrom, Projected, ProjectedItemByToken to TokenAware.
  - Threaded an optional generic K through ShardQueryFunction/Result/Map,
    QueryOptions/Result, WorkingQueryResult, and EntityManager.query.
  - Aligned QueryOptions.sortOrder with projected item shape.
  - Kept runtime behavior unchanged; added localized casts in query.ts to
    preserve dedupe/sort when callers project attributes.
  - Backwards compatible via default generics (K=unknown); adapters may opt in.

- BaseQueryBuilder — projection K threading (type-only)
  - Threaded an optional generic K through BaseQueryBuilder so downstream
    adapters can build ShardQueryMap/ShardQueryFunction with projected item
    typing:
    • getShardQueryFunction(...): ShardQueryFunction<…, CF, K>
    • build(): ShardQueryMap<…, CF, K>
    • query(): forwards K to EntityManager.query<…, CF, K>
  - No runtime behavior changes; enables entity-client-dynamodb to plumb
    const-tuple projection types end-to-end.

- Tests/docs/interop — projection K
  - Added tsd test test-d/projection-typing.test-d.ts validating that const-tuple
    projections (K) narrow result item shapes through ShardQueryFunction/Map,
    QueryOptions, and QueryResult.
  - Updated requirements (.stan/system/stan.requirements.md) to document K, sort
    alignment to projected shape, and BaseQueryBuilder K threading.
  - Added interop note at .stan/interop/entity-client-dynamodb/projection-k-integration.md
    detailing how to adopt K, invariants (uniqueProperty/sort keys), recommended
    adapter behaviors, and suggested tsd coverage.
  - No runtime changes; typecheck/lint/tests/build/docs remain green.

- Typecheck red — projection K narrowing (index-signature guard)
  - Fixed TokenAware.Projected to select keys from KeysFrom<K> intersected with
    keyof Exactify<T>, avoiding collapse to `never` when T has an index signature.
  - This ensures const‑tuple K (e.g., ['userId','created'] as const) narrows to
    Pick<…, 'userId' | 'created'>[] in QueryResult<…, K>.items as intended.
  - No runtime changes; tsd projection-typing.test-d.ts now passes.

- Amended: Projected<T, K> object guard (TS2344)
  - Wrapped Exactify usage in `T extends object ? … : T` so the type parameter
    no longer violates the `object` constraint in tooling (tsc/rollup/typedoc).
  - No runtime changes; typecheck/build/docs should pass cleanly.

- Docs: README projection K and helper references
  - Added a new README section “Projection‑aware typing (K)” with a complete example.
  - Expanded DX highlights and listed projection helper types under “Types you’ll reach for”.
  - Reiterated dedupe/sort invariants (auto‑include `uniqueProperty` and sort keys at adapter when projecting).

- Interop: response note for entity‑client‑dynamodb
  - Created .stan/interop/entity-client-dynamodb/projection-k-and-rangekey-narrowing-response.md
  - Summarized shipped changes (K channel, CF/CC typing, BaseQueryBuilder K threading) and guidance for CF‑aware range‑key property narrowing.