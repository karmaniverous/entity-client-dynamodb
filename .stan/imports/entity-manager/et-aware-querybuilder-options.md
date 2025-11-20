# Interop — ET‑aware QueryBuilder options (remove `item: never` casts)

Context

- Upstream (entity‑manager) made `QueryBuilderQueryOptions` ET‑aware and updated `BaseQueryBuilder.query` to accept the new alias. This fixes a long‑standing typing hole where `options.item` was `never` at `builder.query(...)` call sites, forcing casts like `{ } as never` in consumers.
- This is a types‑only change; no runtime semantics are affected.

What changed upstream (entity‑manager)

- Type alias now carries ET:

```ts
// before
export type QueryBuilderQueryOptions<
  CC extends BaseConfigMap,
  CF = unknown,
> = Omit<
  QueryOptions<CC, never, string, CF>,
  'entityToken' | 'pageKeyMap' | 'shardQueryMap'
>;

// after
export type QueryBuilderQueryOptions<
  CC extends BaseConfigMap,
  ET extends EntityToken<CC>,
  CF = unknown,
> = Omit<
  QueryOptions<CC, ET, string, CF>,
  'entityToken' | 'pageKeyMap' | 'shardQueryMap'
>;
```

- BaseQueryBuilder.query now reflects ET into the options type:

```ts
// before
async query(options: QueryBuilderQueryOptions<CC, CF>): Promise<...>;

// after
async query(options: QueryBuilderQueryOptions<CC, ET, CF>): Promise<...>;
```

Required change downstream (entity‑client‑dynamodb)

- Update the DynamoDB adapter’s `QueryBuilder.query` signature to accept the ET‑aware options (no runtime logic change):

```ts
// before
query(options: QueryBuilderQueryOptions<C, CF>): Promise<QueryResult<C, ET, ITS, K>>;

// after
query(options: QueryBuilderQueryOptions<C, ET, CF>): Promise<QueryResult<C, ET, ITS, K>>;
```

Notes

- The adapter already carries `ET` in its class generics; this change simply aligns the options type with the builder’s entity token so `options.item` is correctly typed as `EntityItemByToken<C, ET>`.
- No other signatures need to change. CF/K generics and runtime behavior remain the same.

Acceptance criteria (types)

- A typed builder compiles without casts at call sites:

```ts
const qb = createQueryBuilder({
  entityClient,
  entityToken: 'user' as const,
  hashKeyToken: 'hashKey2' as const,
  cf: {
    indexes: { created: { hashKey: 'hashKey2', rangeKey: 'created' } },
  } as const,
});

await qb.query({
  // item MUST be typed as EntityItemByToken<C, 'user'> (no cast required)
  item: { userId: 'u1' },
  timestampFrom: 0,
  timestampTo: Date.now(),
});
```

- Optional tsd check (adapter repo):

```ts
import { expectType } from 'tsd';
import type {
  QueryBuilderQueryOptions,
  EntityItemByToken,
} from '@karmaniverous/entity-manager';

type Opt = QueryBuilderQueryOptions<MyConfigMap, 'user'>;
declare const opt: Opt;
expectType<EntityItemByToken<MyConfigMap, 'user'>>(opt.item);
```

Versioning

- This is a public type‑surface change. Bump the adapter to depend on the new entity‑manager version that includes ET‑aware options and publish together. No runtime behavior changes are introduced.

Rationale

- Restores the intended “no generics, no casts” DX for consumers of the DynamoDB adapter by threading the builder’s `ET` into `QueryBuilderQueryOptions`.
