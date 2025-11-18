# Development Plan

## Next up (in priority order)

- Client integration: update entity-client-dynamodb QueryBuilder<CC, EM, ET, ITS> to adopt new SQFBI/QO/QR; typed page keys (PKBI/PKMBIS); add typed getItems overloads keyed by ET. Provide convenience helpers to build typed ShardQueryMap from config literals (CF-aware).
- Update entity-manager-demo to use entitiesSchema factory + token-aware calls; refresh examples.

- Step 4 — Documentation and examples (DX)
  - Update README and API docs to:
    - Prefer the factory (values-first) + “satisfies/as ~const” guidance.
    - Demonstrate token-aware add/remove/keys and index-aware page keys, with inference across values (no explicit generics). Include CF helpers (QueryOptionsByCF, ShardQueryMapByCF).
  - Provide concise usage snippets for PageKey typing by index; sorting with defineSortOrder<E> (entity-tools); and config authoring patterns.

- Step 5 — Type tests and guardrails
  - Optional: add a CI check that scans generated d.ts to enforce strict acronym dictionary for template params.
  - Optional: add a simple CI check or script to scan generated d.ts and assert template parameter names follow the strict acronym dictionary.

- Step 6 — Release and coordination
  - Bump version with release notes summarizing:
    - values-first factory, strict acronyms, token/index-aware typing, decodeGeneratedProperty requiring ET.
  - Open/refresh the interop note for entity-client-dynamodb (provisional) and proceed with its refactor:
    - QueryBuilder<CC, EM, ET, ITS> adopting SQFBI, QO, QR; typed page keys per index (PKBI/PKMBIS).
    - Add typed overloads for getItems returning ERBT<CC, EM, ET>[] keyed by ET (retain broad fallback).
  - Update entity-manager-demo after client integration.

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