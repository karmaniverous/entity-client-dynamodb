# Development plan

## Next up

- Consider adding a lightweight docker-availability helper for reuse across
  integration tests (shared test util).
- Expand tsd coverage for exported types (TranscodeAttributeTypeMap usage and
  QueryBuilder public types).
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