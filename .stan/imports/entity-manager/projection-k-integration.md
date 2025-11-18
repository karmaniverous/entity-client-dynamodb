# Interop — Adopting projection-aware typing (K) from entity-manager

Purpose

- Document how entity-client-dynamodb can adopt the new type-only projection channel K in entity-manager to narrow result item shapes end-to-end when callers project attributes.

What changed upstream (entity-manager)

- New helper types: KeysFrom<K>, Projected<T, K>, ProjectedItemByToken<CC, ET, K>.
- K is threaded (default unknown) through the query pipeline:
  - ShardQueryFunction<CC, ET, IT, CF, K>, ShardQueryResult<…, K>, ShardQueryMap<…, K>.
  - QueryOptions<…, K>, QueryResult<…, K>; EntityManager.query<…, K>(…).
  - BaseQueryBuilder<…, CF, K>, getShardQueryFunction(): ShardQueryFunction<…, CF, K>.
  - QueryOptions.sortOrder is aligned to the projected shape ProjectedItemByToken<…, K>.
- No runtime behavioral changes.

Adapter surface (entity-client-dynamodb)

1) Carry K from attributes as const tuples
   - When building a ShardQueryMap and invoking EntityManager.query, pass K as a const tuple of projected attribute names:
     ```ts
     const attrs = ['userId', 'created'] as const;
     // K = typeof attrs
     const map: ShardQueryMap<CC, ET, ITS, CF, typeof attrs> = { ... };
     const options: QueryOptions<CC, ET, ITS, CF, typeof attrs> = { entityToken, item, shardQueryMap: map };
     const result = await entityManager.query(options);
     // result.items is now Pick<EntityItemByToken<CC, ET>, 'userId' | 'created'>[]
     ```

2) Preserve dedupe/sort invariants
   - EntityManager dedupes by uniqueProperty and sorts by QueryOptions.sortOrder. If the adapter projects attributes at runtime and omits these keys, dedupe/sort degrade at runtime.
   - Recommended behavior:
     - Auto-include uniqueProperty and any explicitly requested sort keys in the ProjectionExpression if omitted by callers.
     - Keep this behavior documented and tested; projection typing remains type-only, while the adapter enforces invariants for runtime resilience.

3) Sort typing alignment
   - QueryOptions.sortOrder is typed over ProjectedItemByToken<CC, ET, K>. If K does not include the sort keys, type-checking will flag it.
   - Either instruct callers to include sort keys in attrs or auto-include them as above.

4) Example pattern (QueryBuilder)
   - Provide a convenience method or option to pass attributes as const tuples:
     ```ts
     const qb = createQueryBuilder({ entityClient, entityToken, hashKeyToken, cf });
     // hypothetical helper that sets projection tuple K on the builder
     qb.indexParamsMap.firstName = { ... };
     // At the call site, build and query with typed projection K
     const attrs = ['userId', 'created'] as const;
     const shardQueryMap = qb.build() as ShardQueryMap<CC, ET, ITS, CF, typeof attrs>;
     const options: QueryOptions<CC, ET, ITS, CF, typeof attrs> = { entityToken, item: {}, shardQueryMap };
     const result = await entityManager.query(options);
     ```

TSD tests (compile-time) — recommendations

- Add a test that asserts narrowing with const tuple attrs across:
  - ShardQueryFunction/Map types carrying K,
  - QueryOptions carrying K,
  - QueryResult items narrowed to Pick<EntityItemByToken<…>, KeysFrom<K>>.

Backwards compatibility

- Source-compatible by default: K defaults to unknown; existing adapter usage remains valid.

Documentation updates

- Note that projection typing is type-only; runtime projection execution belongs to the adapter.
- Document the auto-include policy for uniqueProperty and sort keys to maintain stable dedupe/sort.

Migration/Rollout plan

1) Adopt K generics in the adapter signatures where relevant (no runtime changes).
2) Add optional helper to set attributes as const tuples and propagate K.
3) Update docs and add tsd tests.
4) Keep the policy to auto-include uniqueProperty and sort keys at runtime for resilience.
