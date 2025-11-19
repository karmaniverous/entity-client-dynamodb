# Development plan

## Next up (priority order)

- Release v0.4.0
  - Run `npm run release` (release-it; CHANGELOG, tag, publish).
  - Ensure `.env.local` has GITHUB_TOKEN if releasing locally.

## Completed

- None

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