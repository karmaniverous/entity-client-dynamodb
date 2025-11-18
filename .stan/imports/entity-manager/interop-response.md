# Interop response — entity-manager → entity-client-dynamodb

Scope

- This document summarizes the changes made in `@karmaniverous/entity-manager` that fulfill (and extend) the interop expectations captured in the provisional note for `entity-client-dynamodb`.
- Goal: ensure the client can adopt index- and token‑aware typing with minimal ceremony, while preserving runtime behavior.

What the client asked for (provisional)

- QueryBuilder generics: `<CC, EM, ET, ITS>`; build typed shard query maps; query with typed options/results.
- Page keys typed per index (`PKBI` / `PKMBIS`).
- SQF typing keyed by index: pageKey narrowed to index components.
- Values-first / inference-first; prefer `as const`/`satisfies` patterns.
- Typed overloads for `getItems` by ET (in the client).
- Convenience to build typed `ShardQueryMap` from config literals.

What is delivered here (entity-manager)

1) Token/index-aware core (done)

- `ShardQueryFunction<CC, ET, IT, CF>` (SQF) with CF‑driven pageKey narrowing (index components only).
- `ShardQueryMap<CC, ET, ITS, CF>` with CF.indexes key constraint (excess keys rejected).
- `QueryOptions<CC, ET, ITS, CF>` and `QueryResult<CC, ET, ITS>` thread ET/ITS/CF end‑to‑end.
- `PageKeyByIndex` and `PageKeyMapByIndexSet` for index‑aware page keys.

2) BaseQueryBuilder (ready for the client)


3) Values‑ and schema‑first configuration (DX)

- `createEntityManager(config, logger?)` (values-first) captures literal tokens.
- Optional `entitiesSchema` (Zod) enables schema‑first inference of entity shapes without generics.

4) Helper typing tightened (done)

- `getIndexComponents` and `unwrapIndex` now accept and return CF/IT‑aware component tokens; `omit` is typed to components/elements.

5) CF helpers (derive ITS from config.literal) (done)

- `IndexTokensOf<CF>`: capture the union of index tokens from `CF.indexes`.
- `QueryOptionsByCF`, `ShardQueryMapByCF`: derive `ITS` from `CF.indexes` and pass CF through the channel for page‑key narrowing.

6) CC helpers (DX sugar, beyond original ask) (new)

- `IndexTokensFrom<CC>` (existing helper) + new aliases:
  - `QueryOptionsByCC<...>`: derive ITS from a values‑first captured config and reuse the same CC for page‑key narrowing (CF channel).
  - `ShardQueryMapByCC<...>`: same as above for `ShardQueryMap`.
  
Rationale: the client often has the captured config type (the CC) available; these aliases reduce manual threading of `ITS` while preserving all narrowing guarantees.

7) Documentation and tests (DX)

- README rewritten with DX emphasis: values/schema‑first quick start, token‑aware helpers, CF‑aware querying.
- New tsd tests for CF/CC DX aliases (compile‑time guarantees and key constraints).

What remains in the client (entity-client-dynamodb)

- Adopt the SQF/QO/QR types and PKBI/PKMBIS in the client QueryBuilder.
- Provide typed `getItems` overloads keyed by ET (retain broad fallback).
- Optional: convenience helpers to build a typed `ShardQueryMap` from config literals (CF or CC aware).

Extensions beyond the original request (highlights)

- CC-based aliases (`QueryOptionsByCC`, `ShardQueryMapByCC`) simplify deriving `ITS` from a captured values‑first config type and keep page‑key narrowing active through the CF channel.
- `unwrapIndex` and `getIndexComponents` now thread IT/CF, which makes it easier to write client‑side helpers that manipulate component tokens safely.
- README adjusted to teach values/schema‑first, CF/CC helpers, and token/index‑aware flows without explicit generics.

No changes required by the client’s runtime behavior

- All enhancements are type/DX only; no changes in public runtime semantics.
- Existing client code (without CF/CC aliases) remains source‑compatible.

Suggested sequencing for the client

1) Update its QueryBuilder to use the typed shapes:
   - `ShardQueryFunction<CC, ET, IT, CF>`
   - `ShardQueryMap<CC, ET, ITS, CF>` (or `ShardQueryMapByCF/ByCC`)
   - `QueryOptions<CC, ET, ITS, CF>` (or `QueryOptionsByCF/ByCC`)
   - Use `PageKeyByIndex` / `PageKeyMapByIndexSet` internally.

2) Add typed overloads (by ET) for `getItems` and friends; keep a broad fallback for dynamic‑token paths.

3) Offer a helper to build typed `ShardQueryMap` from config literals (CF or CC), so consumers can do:
   - `const map = buildShardQueryMapByCF<...>(cf, { firstName: sqfA, lastName: sqfB });`

4) Update demos/docs to show values‑first patterns (prefer `as const`) for maximum inference.

Outcome

- The client can adopt fully typed, index‑/token‑aware flows with minimal boilerplate, leveraging both CF- and CC‑based DX sugar added here.
