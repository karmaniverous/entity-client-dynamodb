# Development plan

## Next up

- Design a safe CF-aware property narrowing path for range key property (no
  overload/impl mismatch)
  - Option A (preferred): introduce a typed helper (e.g., rangeKeyProp) that
    encodes IndexRangeKeyOf<CF, ITS> at the call site and returns a narrowed
    property string; implementation remains a single signature.
  - Option B: explore a d.ts-only augmentation that exposes a CF-aware
    overload while leaving the .ts implementation signature unchanged;
    validate across tsc/rollup/typedoc to ensure no TS2394.

- Pin new DX typing with tsd tests
  - EntityClient.getItem/getItems:
    • removeKeys literal true/false → narrow to Item/Record variants.
    • attributes as const tuple → Pick<…> projection narrowing (with token).
    • combined cases (tuple + removeKeys literal).
  - QueryBuilder/EntityManager query typing:
    • createQueryBuilder({ cf }) → ITS derived from cf; PageKeyByIndex typed
    by index; ShardQueryFunction pageKey param narrowing.
    • Negative cases for invalid index keys and wrong page-key shapes.

- Document adapter ProjectionExpression policy
  - When a projection is supplied, auto-include uniqueProperty and any sort
    keys to preserve dedupe/sort invariants at runtime. Add a concise note to
    README/Typedoc and, where feasible, a focused test asserting invariants.

- Expand tsd coverage for public types
  - TranscodeAttributeTypeMap usage and QueryBuilder public types
    (index params, addFilterCondition/addRangeKeyCondition inputs).

- Optional DX: add a lightweight docker-availability helper for reuse across
  integration tests (shared test util).

- Add batch write unprocessed requeue tests. (Planned)

## Completed (recent)

- QueryBuilder: preserve native scalar types in ExpressionAttributeValues for
  comparison/between/contains/in (no .toString()), and filter undefined values
  in "in" conditions. This fixes numeric BETWEEN on created in integration test.

- BatchWrite retries: fixed unprocessed item extraction to return original
  Items/Keys from WriteRequest objects for both putItems and deleteItems,
  ensuring correct retry behavior.

- Purge robustness: refactored purgeItems() to iterate using LastEvaluatedKey
  rather than items.length, ensuring complete table scans even when pages are
  sparsely populated.

- Single tsconfig: keep all TS (src, tests, configs) type-checked by tsc; let tsd
  own test/types/**. Fixed tsconfig exclude to "test/types/**" so rollup/tsc do
  not type-check .test-d.ts files.

- Vitest migration: replaced remaining Mocha lifecycle usage with `beforeAll`/
  `afterAll` in nested suites.

- Integration test stability: removed skip gating and added a Docker preflight
  wait with retries; tests no longer skip on first run and remain green on
  subsequent runs.

- Test timeouts: consolidated with Vitest global `hookTimeout` in
  `vitest.config.ts`.

- Removed unused `@types/eslint__js` devDependency and cleaned knip config
  (dropped obsolete ignoreDependencies). Knip runs clean.

- Decompose EntityClient monolith
  - Split src/EntityClient/EntityClient.ts into small method modules under
    src/EntityClient/methods/\*. Class now delegates to helpers; public API
    unchanged and each file is well under the 300 LOC threshold.

- getItems projection: add attributes[] overload
  - Added getItems(keys, attributes, options?) overload and wired per-table
    ProjectionExpression and ExpressionAttributeNames in BatchGet.
  - Kept existing behavior and return types; no consolidation with getItem.

- Interop: drafted z.infer d.ts bug report to entity-manager and saved at
  .stan/interop/entity-manager/z-infer-dts-bug.md. Proposed upstream fix:
  remove the named zod “infer” import and use z.infer<...> at type sites,
  republish a patch so tsc/typedoc/build pass downstream.

- QueryBuilder SQF return shape
  - Updated getShardQueryFunction to return items as EntityItemByToken<C, ET>[]
    and to include pageKey only when present (optional), matching
    ShardQueryFunction<C, ET, ITS, CF>.

- QueryBuilder SQF return typing
  - Eliminated inferred union by anchoring the return to ShardQueryResult and
    setting pageKey conditionally on presence (optional property).

- QueryBuilder SQF assignability
  - Explicitly typed the returned async function as ShardQueryFunction<C, ET, ITS, CF>
    to satisfy conditional typing and resolve TS2322 during build/docs/typecheck.

- QueryBuilder SQF conditional cast
  - Due to conditional typing on ShardQueryFunction with CF/IT, returned async
    function is cast via unknown as ShardQueryFunction<C, ET, ITS, CF> to avoid
    TS2322 while preserving the correct public signature and runtime behavior.

- Types import/export fix (build/docs/lint)
  - Fixed TS2304 by importing type EntityItemByToken from @karmaniverous/entity-manager
    in src/EntityClient/EntityClient.ts wherever it was referenced in public
    return types.
  - Re-exported EntityToken, EntityItemByToken, and EntityRecordByToken from
    the package root (src/index.ts) to match README DX guidance.
  - Suppressed a false-positive ESLint no-unnecessary-condition on the token-
    aware guard in EntityClient.getItems(). Lint/typecheck/docs now pass locally
    with this change set.

- Docs: external symbol mapping cleanup
  - Added externalSymbolLinkMappings for entity-manager Config and ConfigMap,
    and entity-tools EntityMap to silence remaining Typedoc warnings about
    unresolved links in public comments.
- Docs warning cleanup
  - Updated JSDoc in TranscodeAttributeTypeMap to reference
    DefaultTranscodeRegistry (was DefaultTranscodeMap).

- DX: createQueryBuilder factory (CF-aware)
  - Added createQueryBuilder<C, ET, CF> that infers ET from entityToken and CF
    from options, deriving ITS as IndexTokensOf<CF>. Returns a typed
    QueryBuilder without generic arguments at call sites.

- DX: getItems ET-specific overloads
  - Added non-breaking overloads to EntityClient.getItems that accept an
    entityToken value and return items typed as EntityRecordByToken<C, ET>[].
    Implementation remains unified and ignores the token at runtime; call sites
    get narrower types without generics.

- DX: getItems overload compatibility (TS2394)
  - Switched implementation signature to varargs and normalized inputs
    internally to satisfy all overloads.

- Build: createQueryBuilder export cleanup
  - Removed default export and referenced CF via `void cf` to resolve rollup
    mixed-exports warning and lint error.

- DX: finalize getItems overload compatibility
  - Widened implementation signature return to Promise<any> to satisfy TS2394
    while preserving strongly typed overloads for call sites.

- Interop: added projection‑aware typed query results note for entity-manager at .stan/interop/entity-manager/projection-aware-typed-query-results.md (type-only K channel through QueryOptions/Result/SQF; no runtime changes)

- DX: removeKeys literal overloads (token-aware)
  - Added overloads to EntityClient.getItem/getItems that narrow return types
    when options.removeKeys is a literal true/false. No runtime changes.
  - Added tuple-aware overloads for token-aware calls with attributes declared
    as const tuples; results narrow to Pick<…> over those keys, combined with
    removeKeys literal when provided.

- QueryBuilder typing (CF-aware, optional)
  - Tightened addRangeKeyCondition param types: indexToken accepts ITS, and
    when a config literal (CF) is supplied, the condition.property narrows to
    the index’s rangeKey; otherwise remains string. No runtime changes.

- Fix: QueryBuilder addRangeKeyCondition overloads
  - Added CF-aware overload while keeping implementation signature as RangeKeyCondition to satisfy TS union assignability and avoid TS2345 during build/docs.

- Fix: QueryBuilder overload compatibility (TS2394)
  - Removed extra generic from CF-aware overload and used IndexRangeKeyOf<CF, ITS> directly; dropped unused HasIndexFor import. Implementation remains (ITS, RangeKeyCondition). No runtime changes.

- Fix: QueryBuilder CF-aware overload fallback
  - Ensured CF-aware property type falls back to string when no literal can be
    resolved (avoids ‘never’ and keeps overload compatible with implementation).

- Amendment: Retained CF-aware property narrowing without overloads
  - Replaced the overloadimplementation pair with a single CF-aware method
    signature for addRangeKeyCondition that narrows `condition.property` via
    IndexRangeKeyOf<CF, ITS>. This resolves TS2394 while preserving CF-aware
    DX. No runtime changes; Typedoc/rollup/tsc remain compatible.

- Amendment: CF-aware property fallback guard (no runtime change)
  - Updated addRangeKeyCondition signature to use an IfNever-style conditional
    for `property`, so when CF is absent the type falls back to `string`.
  - Preserves CF-aware narrowing when CF is provided; restores typecheck/build/
    docs by avoiding `never` at call sites.
