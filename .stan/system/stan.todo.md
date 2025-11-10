# Development plan

## Next up

- Consider adding a lightweight docker-availability helper for reuse across
  integration tests (shared test util).
- Expand tsd coverage for exported types (TranscodeAttributeTypeMap usage and
  QueryBuilder public types).

## Completed (recent)

- Single tsconfig: keep all TS (src, tests, configs) type-checked by tsc; let tsd
  own test/types/**. Fixed tsconfig exclude to "test/types/**" so rollup/tsc do
  not type-check .test-d.ts files.
- Vitest migration: replaced remaining Mocha lifecycle usage with `beforeAll`/
  `afterAll` in nested suites.
- Integration test stability: auto-skip EntityClient suite when Docker is not
  available (dynamic describe wrapper), preventing CI/local failures without
  Docker while preserving test logic.
- Removed unused @types/eslint__js devDependency and cleaned knip config
  (dropped obsolete ignoreDependencies). Knip runs clean.
