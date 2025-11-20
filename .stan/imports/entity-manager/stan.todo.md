# Development Plan

## Next up (in priority order)

None

## Completed (append-only)

**CRITICAL: This list is append-only; do not edit items! Place most recent entries at the BOTTOM of the list. When pruning, remove older entries from the top.**

- Accept compile-time `entitiesSchema` in both flows:
  - Strip `entitiesSchema` (whitelist) in EntityManager constructor before Zod
    parsing so the same values-first config literal works via factory or direct
    constructor; runtime config remains unchanged.
  - Added runtime tests for factory/constructor acceptance and key validations:
    query param validation (limit/pageSize), rehydrate edge cases, key update
    error paths, and validator error paths.

- Lint and test fixes:
  - Adjust SQF in query.validation.test.ts to return Promise.resolve and
    reference unused params (no async/await), satisfying ESLint.
  - Fix rehydrateIndexItem mismatch test to force segment-count mismatch.
  - Use now + day in hash-key update validation to require uniqueProperty.

- Interop (types): Make QueryBuilder options ET-aware to restore cast-free DX.
  - Changed QueryBuilderQueryOptions to carry ET and updated
    BaseQueryBuilder.query to accept QueryBuilderQueryOptions<CC, ET, CF>.
  - Eliminates `item: never` at builder.query sites; no runtime changes.

- Tests: pin ET-aware QueryBuilder options typing with tsd.
  - Added test-d/querybuilder-options-et-aware.test-d.ts to assert
    options.item resolves to EntityItemByToken<CC, ET> without casts.

- Tests: adjust tsd expectations for structural assignability.
  - Removed negative expectNotAssignable checks between different ETs since
    EntityItemByToken is structurally assignable (Partial + index signature).

- Interop: document ET-aware QueryBuilder options change for adapter.
  - Added .stan/interop/entity-client-dynamodb/et-aware-querybuilder-options.md
    with the exact signature change and acceptance criteria.
