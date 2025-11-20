# Development plan

## Next up (priority order)

- Release v0.4.0
  - Run `npm run release` (release-it; CHANGELOG, tag, publish).
  - Ensure `.env.local` has GITHUB_TOKEN if releasing locally.

## Completed

- Interop typing (local; no upstream dependency)
  - addRangeKeyCondition/addFilterCondition accept a generic BaseQueryBuilder
    plus the minimal structural contract (indexParamsMap + logger).
  - TSD: added helper-assignability test to assert QueryBuilder<C, …> is
    assignable to helper params without casts at call sites.

- TSD coverage hardening
  - Added negative test: invalid index token when CF is present (excess
    property checks).
  - Confirmed non-literal removeKeys typing:
    • getItems('token', …, { removeKeys: boolean }) → union-of-arrays
    (EntityRecordByToken[] | EntityItemByToken[]).
    • getItem('token', …, { removeKeys: boolean }) → union (plus undefined).
  - Tuple projections remain pinned to Pick<…> over correct base for
    removeKeys true/false.

- Docs polish
  - README/API includes compact CF + PageKeyByIndex example.
  - Notes captured for non-literal removeKeys typing and projection policy
    (auto-include uniqueProperty and explicit sort keys).

- Batch nicety tests
  - Added “unprocessed requeue” tests for batch put/delete to pin behavior
    when UnprocessedItems are returned (requeue verified).

- Tests/lint hardening
  - Refined batch requeue tests to avoid `any` casts and satisfy
    `@typescript-eslint/require-await`; stubs now omit `UnprocessedItems`
    when empty so later outputs match the expected undefined property.

- Variance polish (types only)
  - Relaxed internal addQueryCondition* helpers to accept a MinimalBuilder
    (indexParamsMap + logger) instead of a concrete QueryBuilder type.
  - Removed local variance-bridging casts from addRangeKeyCondition and
    addFilterCondition. No runtime behavior change.

- Interop (entity-manager): make QueryBuilder.query accept ET-aware options
  - Updated QueryBuilder.query signature to
    QueryBuilderQueryOptions<C, ET, CF> and forwarded unchanged to super.
  - Fixes TS2344/TS2345 in typecheck/build/docs with no runtime changes.
- Breaking: remove removeKeys option from token-aware reads
  - Eliminated GetItemOptions/GetItemsOptions and all removeKeys overloads.
  - Token-aware getItem/getItems now always return records; strip keys in
    handlers via entityManager.removeKeys when domain objects are desired.
  - Kept the token-aware overload that accepts a TableName-bearing
    GetCommandInput (as requested). No convenience helper added.
  - Updated README and removed the tsd test covering removeKeys typing.

- Lint: remove unused local in EntityClient.getItem
  - Deleted the unused `entityToken` variable and assignment in getItem(...args) to satisfy @typescript-eslint/no-unused-vars.