# Interop Note — entity-manager by-token refactor (v8) and adapter impact

Audience: Maintainers of `@karmaniverous/entity-client-dynamodb` and downstream adapters

This note summarizes the public API and type model changes recently made in `@karmaniverous/entity-manager`, and what you need to do in the DynamoDB adapter to align. You do not need any external documents to understand this note.

## What changed in entity-manager

1) New, by-token type family (replaces legacy names)

- Replaced the legacy types:
  - `EntityItemByToken<CC, ET>`
  - `EntityRecordByToken<CC, ET>`

  With the following by-token types:

  - `EntityItem<CC, ET>` — strict domain (full), now also carries optional key/token properties (hashKey, rangeKey, sharded/unsharded) for convenience.
  - `EntityItemPartial<CC, ET, K>` — projected/seed domain; conditional behavior:
    - If K is provided: projected keys are required (compile-time strict).
    - If K is omitted: permissive partial (good for seeds).
  - `EntityRecord<CC, ET>` — DB record (required keys) + partial domain fields (relaxed to fit real-world DB reads).
  - `EntityRecordPartial<CC, ET, K>` — projected DB record.

2) Query and shard contracts thread by-token types

- `QueryOptions.item` is now `EntityItemPartial<CC, ET, K>`.
- `QueryResult.items` is `EntityItemPartial<CC, ET, K>[]`.
- `ShardQueryFunction<CC, ET, IT, CF, K>` and `ShardQueryResult` accept/return projected items aligned with K.
- Index-aware page keys: `PageKeyByIndex<CC, ET, IT, CF>` (typed by index). Internally, page-key composition uses `StorageItem<CC>`; this type is now exported for reference.

3) Page-key typing and helpers

- `PageKeyByIndex` narrows to the index’s component tokens; it is used in `ShardQueryFunction` and page-key re/dehydration.
- `StorageItem<CC>` and `StorageRecord<CC>` are exported (type-only) so TypeDoc can link to them. They are token-agnostic storage shapes used by property-level helpers.

4) Projection K invariant (type-only)

- When K (projection) is present, item types are narrowed to `Pick<...>` on those keys.
- Runtime adapters (e.g., DynamoDB) should auto-include `uniqueProperty` and any explicit sort keys to preserve dedupe/sort invariants. The DynamoDB adapter already enforces this in `QueryBuilder.query()`.

## What you need to change in the DynamoDB adapter

1) Update imports and type names

- Replace the old type names with the new family, for example:

```ts
// Before
import type {
  EntityRecordByToken,
  EntityItemByToken,
} from '@karmaniverous/entity-manager';

// After
import type {
  EntityRecord,
  EntityRecordPartial,
  EntityItem,
  EntityItemPartial,
} from '@karmaniverous/entity-manager';
```

2) getItem(s) result typing

- Keep the overloads but return the new types:
  - Without attributes → `EntityRecord<CC, ET>`
  - With attributes A → `EntityRecordPartial<CC, ET, A>`

```ts
// Example (unchanged signatures, new types)
getItems<ET extends EntityToken<C>, A extends readonly string[]>(
  entityToken: ET,
  keys: EntityKey<C>[],
  attributes: A,
  options?: BatchGetOptions,
): Promise<{
  items: Projected<EntityRecord<C, ET>, A>[];
  outputs: BatchGetCommandOutput[];
}>;

getItems<ET extends EntityToken<C>>(
  entityToken: ET,
  keys: EntityKey<C>[],
  options?: BatchGetOptions,
): Promise<{
  items: EntityRecord<C, ET>[];
  outputs: BatchGetCommandOutput[];
}>;
```

3) QueryBuilder generics and projection K

- `QueryBuilder<C, ET, ITS, CF, K>` remains the primary class. When you call:
  - `setProjection(indexToken, attrs as const)` → the builder’s `K` becomes that const tuple and result items are typed as `EntityItemPartial<CC, ET, K>`.
  - `resetProjection(...)` or `resetAllProjections()` → K widens back to `unknown`, result items become permissive partials.
- Query-time invariant (already implemented): When any projection is present, auto-include the entity’s `uniqueProperty` and explicit sort keys.

4) PageKey typing remains index-aware


5) Optional: helper parameters (variance-friendly)

- If your adapter helper functions accept a `BaseQueryBuilder` shape (e.g., `addRangeKeyCondition`, `addFilterCondition`), continue to use a structural intersection that targets the mutable state they actually use (e.g., `indexParamsMap`, `entityClient.logger`). This removes the need for variance casts and preserves ITS inference from the builder instance.

```ts
// Example shape for variance-friendly helpers
type MinimalBuilder<CC, Client, ET, ITS, CF, K> =
  BaseQueryBuilder<CC, Client, unknown, ET, ITS, CF, K> & {
    indexParamsMap: Record<ITS, IndexParams>;
    entityClient: { logger: Pick<Console, 'debug' | 'error'> };
  };
```

## Migration guide (old → new)

| Old                                  | New (by-token model)                                   |
|--------------------------------------|---------------------------------------------------------|
| `EntityItemByToken<CC, ET>`          | `EntityItemPartial<CC, ET>` (seed/partial)             |
| `EntityRecordByToken<CC, ET>`        | `EntityRecord<CC, ET>` (full DB) or `EntityRecordPartial<CC, ET, K>` (projected) |
| `ProjectedItemByToken<CC, ET, K>`    | `EntityItemPartial<CC, ET, K>`                         |

Notes:
- You can often replace `EntityItemByToken<..., ET>` with `EntityItemPartial<..., ET>` directly.
- For DB results, pick `EntityRecord<...>` when no projection is used, and `EntityRecordPartial<..., K>` when attributes are projected.

## Sample adapter snippets (aligned)

1) QueryBuilder projection lifecycle

```ts
// Narrow result items to the projected shape (required keys)
builder
  .setProjection('firstName', ['userId', 'created'] as const)
  .addRangeKeyCondition('firstName', { property: 'firstNameCanonical', operator: 'begins_with', value: 'li' });

const res = await builder.query({ item: {}, limit: 100 });
// res.items: EntityItemPartial<CC, 'user', ['userId','created']>[]

// Widen back to full (permissive) partials
builder.resetProjection('firstName');
```

2) getItems overload usage

```ts
// Full DB rows (strict keys present + partial domain props)
const full = await client.getItems('user', keyList);
// full.items: EntityRecord<CC, 'user'>[]

// Projected DB rows (required projected keys)
const proj = await client.getItems('user', keyList, ['userId', 'created'] as const);
// proj.items: EntityRecordPartial<CC, 'user', ['userId','created']>[]
```

3) Page-key function typing

```ts
const sqf: ShardQueryFunction<CC, 'user', 'firstName', CF, ['userId']> =
  async (hashKey, pageKey, pageSize) => {
    // pageKey is narrowed to the index components for 'firstName'
    // Implementation uses DynamoDBDocumentClient query (omitted)
    return { count: 0, items: [], pageKey };
  };
```

## Versioning guidance

- This is a breaking type surface relative to v7; the natural target is v8.0.0 for entity-manager.
- For the DynamoDB adapter, recommend a major bump if you drop the legacy names entirely, or a minor with deprecation aliases if you retain them for one release:
  - `export type EntityItemByToken<CC, ET> = EntityItemPartial<CC, ET>;`
  - `export type EntityRecordByToken<CC, ET> = EntityRecord<CC, ET>;`
  - Mark them `@deprecated` and remove in the next major.

## Testing & docs checklist for the adapter

- TSD “compile-type” tests:
  - Projected vs. full rows (K present vs. omitted).
  - ShardQueryFunction pageKey typing per index token.
  - QueryBuilder projection lifecycle (set/reset and uniform result typing).

- Runtime tests:
  - Existing query integration tests remain valid; no runtime behavior changes are required.

- Docs:
  - Update examples to use `EntityItemPartial`, `EntityRecord`, `EntityRecordPartial`.
  - Reiterate the projection invariant: *when projecting, the adapter auto-includes `uniqueProperty` and explicit sort keys*.
