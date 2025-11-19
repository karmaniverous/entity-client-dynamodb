# Development plan

## Next up (priority order)

- Interop typing (local; no upstream dependency)
  - Ensure helper acceptance is fully local: addRangeKeyCondition/addFilterCondition
    accept a generic BaseQueryBuilder plus a minimal structural contract
    (indexParamsMap + logger).
  - Remove/avoid any variance-bridging casts in QueryBuilder; keep all calls
    strictly assignable.
  - TSD: add tests asserting that a minimal builder shape and
    QueryBuilder<C, ET, ITS, CF, K> are assignable to helper params (no casts).

- TSD coverage hardening
  - Negative: invalid index token when CF is present (excess property checks).
  - Non-literal removeKeys:
    • getItems('token', …, { removeKeys: boolean }) → union-of-arrays:
    EntityRecordByToken[] | EntityItemByToken[].
    • getItem('token', …, { removeKeys: boolean }) → union (with undefined).
  - Tuple projections: assert Pick<…> over the correct base (Item vs Record)
    for removeKeys true/false.

- Docs (requirements-level polish)
  - README/API:
    • Add a compact example showing CF + PageKeyByIndex typed flow and link to
    the API docs.
    • Document non-literal removeKeys typing (union-of-arrays) and tuple
    projection behavior (Item vs Record).
    • Call out adapter ProjectionExpression policy (auto-include uniqueProperty
    and explicit sort keys) as runtime note.

- Batch write retries
  - Add “unprocessed requeue” tests for put/delete to pin behavior under
    throttling/unprocessed responses.

- Release v0.4.0
  - Run `npm run release` (release-it; CHANGELOG, tag, publish).
  - Ensure `.env.local` has GITHUB_TOKEN if releasing locally.

## Completed

- None
