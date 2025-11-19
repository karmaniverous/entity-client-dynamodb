# Interop — Response to projection K + CF range‑key typing request

Scope

- This note summarizes changes delivered in `@karmaniverous/entity-manager` that address prior requests from `@karmaniverous/entity-client-dynamodb` for projection‑aware results and CF‑aware typing constraints.

What changed upstream (entity‑manager)

1) Projection‑aware typing (type‑only K)
   - Added helper types:
     - `KeysFrom<K>` — normalize string | readonly string[] to a union.
     - `Projected<T, K>` — Pick<T, KeysFrom<K>> with an index‑signature guard.
     - `ProjectedItemByToken<CC, ET, K>` — projected entity items by token.
   - Threaded optional generic K (default `unknown`) through:
     - `ShardQueryFunction/ShardQueryResult/ShardQueryMap`,
     - `QueryOptions/QueryResult/WorkingQueryResult`,
     - `EntityManager.query`,
     - `BaseQueryBuilder` (adapters inherit K end‑to‑end).
   - No runtime changes; K is a type‑only channel so adapters remain in control of ProjectionExpression/selection.
   - Invariants: document that adapters should auto‑include `uniqueProperty` and any explicit sort keys when callers omit them from K to preserve dedupe/sort.

2) CF‑aware typing for index/page‑key flows
   - CF channel (`PageKeyByIndex`, `ShardQueryFunction/Map`) narrows page‑key shapes to exactly the component tokens of each index when a values‑first config literal with `indexes` is supplied.
   - `IndexTokensOf<CF>` helper simplifies ITS (index token subset) derivation for `QueryOptionsByCF` / `ShardQueryMapByCF`.
   - `QueryOptionsByCC` / `ShardQueryMapByCC` derive tokens from a captured config type (`IndexTokensFrom<CC>`) and pass CC through the CF channel for the same narrowing benefits.

3) Query typing and examples
   - `EntityManager.query` updated to carry K/CF so adapters can drive narrowing from their own projection/config inputs.
   - README updated with a concrete K usage example (const‑tuple projections narrowing result items) and DX highlights.

Why this helps the DynamoDB adapter

- Adapter authors can now:
  - Carry attribute tuples as K to get narrowed result types without local casts.
  - Keep CF‑aware page‑key typing and index token sets consistent across builder → shard map → EntityManager.query.
  - Document a simple policy to auto‑include `uniqueProperty` and explicit sort keys in ProjectionExpression to preserve dedupe/sort invariants.

Notes on range‑key property narrowing

- Entity Manager exports CF utilities (e.g., `IndexRangeKeyOf<CF, ITS>`) that allow the adapter to narrow `addRangeKeyCondition`’s `property` to the specific index rangeKey token when CF is present.
- We observed overload vs implementation signature conflicts (TS2394) downstream; the recommended pattern is a single method signature that encodes narrowing with `IndexRangeKeyOf<CF, ITS>` (with a string fallback when no literal is available). This avoids overload/impl mismatches while preserving CF‑aware DX.

Status

- All entity‑manager scripts green (lint/test/typecheck/docs/build) with the above changes.

Action items for the adapter (tracking)

- Adopt K generics where callers provide attributes as const tuples; confirm ProjectionExpression auto‑includes `uniqueProperty` and explicit sort keys when omitted in K.
- Prefer a single, CF‑aware signature for `addRangeKeyCondition`’s `property` using `IndexRangeKeyOf<CF, ITS>` to avoid overload conflicts.
- Expand tsd coverage for:
  - Token‑aware getItem/getItems removeKeys literal narrowing.
  - Tuple‑based K narrowing across SQF/Map/Options/Result.
  - CC/CF helpers (ITS derivation and typed page keys).

References

- Projection K example: see README “Projection‑aware typing (K)”.
- CF/CC helpers and page‑key narrowing: README “Index‑aware querying (CF channel)” and “CC‑based aliases”.
