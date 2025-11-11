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
