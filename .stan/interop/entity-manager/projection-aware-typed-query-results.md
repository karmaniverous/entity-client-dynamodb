# Interop — Projection‑aware typed query results in EntityManager

Purpose
- Provide compile‑time narrowing of query result item shapes when callers select a projection (attributes) in provider adapters.
- Keep entity‑manager provider‑agnostic and runtime‑neutral: this change is type‑only and does not require new runtime inputs.

Current behavior (summary)
- EntityManager.query returns items typed as EntityItemByToken<CC, ET>[] (full domain items without generated/global keys).
- Provider adapters (e.g., entity-client-dynamodb) may pass a projection (attributes) to the underlying datastore, but result item typing remains the full shape.
- Consumers that know they projected a subset must locally cast or accept the wider shape.

Problem
- When a caller (via a provider adapter) projects a specific subset of properties, the result type should narrow correspondingly:
  - Example: projecting ['a', 'b'] should return Pick<EntityItemByToken<…, ET>, 'a' | 'b'>[].
- Today there is no standardized type channel from projection intent to the manager’s result typing, so type inference does not reflect the projection.

Design goals
- Add a type‑only “projection” channel to the query typing so that provider adapters can supply the projected keys and get narrower results — without introducing runtime properties or constraints in entity‑manager.
- Don’t break existing call sites or public types. Defaults must preserve current shapes.
- Preserve CF‑ and IT‑aware typing already threaded through QueryOptions/Result and ShardQueryFunction (page‑key typing, index literal keys).

Proposal — additive, type‑only projection channel

1) New helper types
```ts
// Normalize literals: string | readonly string[] -> union of strings
type KeysFrom<K> =
  K extends readonly (infer E)[] ? Extract<E, string> :
  K extends string ? K :
  never;

// Project item shape by keys; if K is never/unknown, fall back to T
type Projected<T, K> =
  [KeysFrom<K>] extends [never] ? T :
  Pick<T, Extract<keyof T, KeysFrom<K>>>;

// Projected item by token
type ProjectedItemByToken<
  CC extends BaseConfigMap,
  ET extends EntityToken<CC>,
  K
> = Projected<EntityItemByToken<CC, ET>, K>;
```

2) Thread projection K through query types (type‑only)
- Add an optional generic K to the query‑related types; default to unknown to preserve current behavior.

```ts
// Narrowed shard result with optional projection K
interface ShardQueryResult<
  CC extends BaseConfigMap,
  ET extends EntityToken<CC>,
  IT extends string,
  CF = unknown,
  K = unknown
> {
  count: number;
  items: ProjectedItemByToken<CC, ET, K>[];
  pageKey?: PageKeyByIndex<CC, ET, IT, CF>;
}

// Narrowed shard query function (type‑only K)
type ShardQueryFunction<
  CC extends BaseConfigMap,
  ET extends EntityToken<CC>,
  IT extends string,
  CF = unknown,
  K = unknown
> =
  (hashKey: string,
   pageKey?: PageKeyByIndex<CC, ET, IT, CF>,
   pageSize?: number) =>
     Promise<ShardQueryResult<CC, ET, IT, CF, K>>;

// Narrowed QueryOptions (generic K only; no runtime property)
interface QueryOptions<
  CC extends BaseConfigMap,
  ET extends EntityToken<CC> = EntityToken<CC>,
  ITS extends string = string,
  CF = unknown,
  K = unknown
> {
  entityToken: ET;
  item: EntityItemByToken<CC, ET>;
  // ... existing fields unchanged ...
  shardQueryMap: ShardQueryMap<CC, ET, ITS, CF, K>;
  // No new runtime fields for projection; K is type‑only.
}

// Narrowed ShardQueryMap: thread K
type ShardQueryMap<
  CC extends BaseConfigMap,
  ET extends EntityToken<CC>,
  ITS extends string,
  CF = unknown,
  K = unknown
> = Record<ITS, ShardQueryFunction<CC, ET, ITS, CF, K>>;

// Narrowed QueryResult: thread K
interface QueryResult<
  CC extends BaseConfigMap,
  ET extends EntityToken<CC>,
  ITS extends string,
  K = unknown
> {
  count: number;
  items: ProjectedItemByToken<CC, ET, K>[];
  pageKeyMap: string;
}
```

3) EntityManager.query signature (type‑only K)
```ts
query<
  ET extends EntityToken<CC>,
  ITS extends string,
  CF = unknown,
  K = unknown
>(options: QueryOptions<CC, ET, ITS, CF, K>): Promise<QueryResult<CC, ET, ITS, K>>;
```

Notes
- No runtime changes: K is a generic only; no new runtime fields are added to QueryOptions.
- Defaults (K=unknown) preserve today’s result typing.
- Provider adapters that accept an attributes array can instantiate K with that literal to achieve projection‑aware narrowing end‑to‑end.

Provider adapter pattern (entity-client-dynamodb)
- In the DynamoDB adapter, callers may pass attributes as const tuples. The adapter can instantiate the manager call with K equal to that literal:
```ts
const attrs = ['a', 'b'] as const;
// Build ShardQueryMap<…, K=typeof attrs> and pass to EntityManager.query
// Result items narrow to Pick<EntityItemByToken<…>, 'a' | 'b'>[]
```

Why in entity-manager (and not only downstream)?
- The manager already threads ET/IT/CF across the query pipeline and returns typed page keys; it is the natural place to carry the “projection intent” type parameter in a provider‑agnostic way.
- Downstream adapters can then opt in easily without altering runtime contracts.

Backward compatibility
- All new generics default, so the public surface is source‑ and binary‑compatible.
- Existing code keeps full item shapes; only adapters that provide K see the narrowing.

Optional extras (future or in adapter)
- Tuple‑aware convenience:
  - KeysFrom<K> supports readonly tuples out of the box (as const).
  - No changes needed for single string vs array of strings.
- Record‑with‑keys variant:
  - If a provider returns full records (with keys), a companion ProjectedRecordByToken<> can be defined similarly and threaded where needed in that adapter.

TSD test plan (compile‑time)
```ts
import { expectType } from 'tsd';

type EM = /* your EntityMap */;
declare const manager: EntityManager</* captured CC */>;
declare const shardMap: ShardQueryMap</* CC, 'user', 'created', CF, ['a','b'] */>;

// 1) Narrowing with tuple literal
const qr1 = await manager.query({
  entityToken: 'user',
  item: {} as EntityItemByToken</* CC, 'user' */>,
  shardQueryMap: shardMap,
  // ... omit runtime projection; the generic K carries it
});
expectType<Array<Pick<EntityItemByToken</* CC, 'user' */>, 'a' | 'b'>>>(qr1.items);

// 2) No projection (default K) — full item shape
const qr2 = await manager.query({
  entityToken: 'user',
  item: {} as EntityItemByToken</* CC, 'user' */>,
  shardQueryMap: {} as ShardQueryMap</* CC, 'user', 'created' */>,
});
expectType<Array<EntityItemByToken</* CC, 'user' */>>>(qr2.items);

// 3) Projection as union
type P = 'a' | 'b';
const qr3 = await manager.query</* ET, ITS, CF, P */>({
  entityToken: 'user',
  item: {} as EntityItemByToken</* CC, 'user' */>,
  shardQueryMap: {} as ShardQueryMap</* CC, 'user', 'created', unknown, P */>,
});
expectType<Array<Pick<EntityItemByToken</* CC, 'user' */>, P>>>(qr3.items);
```

Docs (API surface guidance)
- Clearly document K as a type‑only projection channel threaded through QueryOptions/Result and ShardQueryFunction.
- Show provider adapter examples (DynamoDB) where attributes: readonly string[] as const narrows K and thus result items.
- Reiterate that entity‑manager does not enforce or apply projections at runtime — it remains provider‑neutral. Projection execution happens in adapters; K only shapes the returned types.

Acceptance criteria
- New helper types (KeysFrom, Projected, ProjectedItemByToken) added.
- K is threaded through ShardQueryFunction/Result/Map, QueryOptions, and QueryResult with defaults.
- EntityManager.query accepts the K channel and returns narrowed QueryResult when provided.
- No runtime behavior changes; typecheck/build/docs pass.
- Downstream adapter can narrow results by supplying K derived from an attributes literal (const tuple or union).
