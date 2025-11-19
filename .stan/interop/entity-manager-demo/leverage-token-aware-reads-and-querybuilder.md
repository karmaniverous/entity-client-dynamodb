# Interop Response — Leverage token‑aware reads and QueryBuilder (entity‑manager‑demo)

Context

- entity‑client‑dynamodb now ships:
  - Token‑aware removeKeys typing for getItem/getItems:
    - removeKeys: true ⇒ EntityItemByToken<…> (domain objects; keys stripped)
    - removeKeys: false ⇒ EntityRecordByToken<…> (storage‑records; keys present)
    - removeKeys: boolean (non‑literal) ⇒ union (Items[] | Records[])
  - Tuple projection narrowing (const tuples) that narrows item shapes.
  - CF‑aware QueryBuilder: pass your config literal (cf) to derive index tokens and per‑index PageKey typing (PageKeyByIndex).
  - Adapter policy: when projections are present, uniqueProperty and any explicit sort keys are auto‑included to preserve dedupe/sort invariants.

This note explains how the demo should consume these capabilities for a DX‑first experience without local casts or wrappers.

## 1) Token‑aware reads: adopt removeKeys semantics

Use token‑aware overloads and let the literal removeKeys flag drive return types:

```ts
import type {
  EntityItemByToken,
  EntityRecordByToken,
} from '@karmaniverous/entity-client-dynamodb';

// Domain objects for UI / business logic (no storage keys)
const users: EntityItemByToken<MyConfigMap, 'user'>[] =
  (await entityClient.getItems('user', keys, { removeKeys: true })).items;

// Storage records when you need keys for follow‑up operations
const recs: EntityRecordByToken<MyConfigMap, 'user'>[] =
  (await entityClient.getItems('user', keys, { removeKeys: false })).items;

// Non‑literal flag: handle both shapes explicitly (union‑aware code)
declare const keepKeys: boolean;
const mixed = await entityClient.getItems('user', keys, { removeKeys: keepKeys });
// mixed.items: EntityRecordByToken[] | EntityItemByToken[]
```

Guidance:
- Prefer removeKeys: true at presentation boundaries (UI, API responses).
- Prefer removeKeys: false when results feed into writes/deletes or compose page keys.
- Keep dynamic flags rare; they correctly produce a union and require a branch.

## 2) Tuple projections (const) for precise shapes

Narrow shapes with const tuples and keep inference end‑to‑end:

```ts
import type { Projected } from '@karmaniverous/entity-client-dynamodb';

const attrs = ['created', 'userId'] as const;
const { items } = await entityClient.getItems('user', keys, attrs, {
  removeKeys: true, // narrows over Item base
});
// items: Projected<EntityItemByToken<MyConfigMap, 'user'>, typeof attrs>[]
```

Notes:
- With removeKeys: true, Pick is applied over EntityItemByToken (domain base).
- With removeKeys: false, Pick is applied over EntityRecordByToken (record base).
- With no token (legacy forms), you’ll get broad EntityRecord shapes.

## 3) CF‑aware QueryBuilder for index/page‑key typing

Pass the config literal (as const) to derive index tokens (ITS) and per‑index page‑key typing:

```ts
import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';

// Your config literal (preserve keys with 'as const')
const cf = {
  indexes: {
    created: { hashKey: 'hashKey2', rangeKey: 'created' },
    lastName: { hashKey: 'hashKey2', rangeKey: 'lastNameRK' },
  },
} as const;

const qb = createQueryBuilder({
  entityClient,
  entityToken: 'user' as const,
  hashKeyToken: 'hashKey2' as const,
  cf, // enables PageKeyByIndex typing & ITS = 'created' | 'lastName'
});

// CF‑aware range key condition: property narrows to the index's rangeKey token
qb.addRangeKeyCondition('created', {
  property: 'created',
  operator: 'between',
  value: { from: 1700000000000, to: 1800000000000 },
});

// Optional: set projections (K‑channel) and scan direction
qb.setProjectionAll(['created', 'lastName'], ['created'] as const);
qb.setScanIndexForward('created', false);

const shardQueryMap = qb.build();
const { items, pageKeyMap } = await entityManager.query({
  entityToken: 'user',
  item: {}, // minimal patch to derive any alternates when needed
  shardQueryMap,
  pageSize: 25,
});
// items: Pick<EntityItemByToken<…, 'user'>, 'created'>[]
// pageKeyMap: dehydrated, index‑aware
```

Paging:
- Persist `pageKeyMap` between requests; pass back into EntityManager.query to fetch the next page.
- PageKey typing is per index (PageKeyByIndex) when cf is present.

## 4) QueryBuilder ergonomics + K channel lifecycle

Adapter guarantees (runtime):
- When projections are present, QueryBuilder.query auto‑includes the entity uniqueProperty and any explicit sort keys in the ProjectionExpression. This preserves dedupe/sort invariants without surprising consumers.

Dev ergonomics (types):
- setProjection(indexToken, tuple) and setProjectionAll(indices, tuple) narrow the builder’s K to the provided tuple (const required for best inference).
- resetProjection / resetAllProjections widen K back to unknown (full item shape).

## 5) TSD tests to add in the demo

To pin the DX:
- Token‑aware removeKeys:
  - Literal true ⇒ EntityItemByToken<…>
  - Literal false ⇒ EntityRecordByToken<…>
  - Non‑literal boolean ⇒ union (plus undefined for single get)
- Tuple projections:
  - Pick over the correct base (Item vs Record) for both flags
- CF presence:
  - addRangeKeyCondition rejects invalid index tokens (excess property checks)
  - Range key condition’s property narrows to the index rangeKey token

Example (sketch):
```ts
import { expectType } from 'tsd';
import type { EntityItemByToken, EntityRecordByToken } from '@karmaniverous/entity-client-dynamodb';

declare const client: EntityClient<MyConfigMap>;
declare const key: EntityKey<MyConfigMap>;
declare const keys: EntityKey<MyConfigMap>[];

const rTrue = await client.getItems('user', keys, { removeKeys: true });
expectType<EntityItemByToken<MyConfigMap, 'user'>[]>(rTrue.items);

const rFalse = await client.getItems('user', keys, { removeKeys: false });
expectType<EntityRecordByToken<MyConfigMap, 'user'>[]>(rFalse.items);
```

## 6) Docs: compact example in demo README

Mirror the README snippet used here:
- CF + PageKeyByIndex typed flow
- Token‑aware removeKeys usage
- Tuple projection note and adapter policy (auto‑include uniqueProperty + sort keys)

## 7) Migration notes (low risk)

- No runtime behavior changes are required in the demo.
- Compile‑time changes may expose places where unions weren’t handled explicitly (for dynamic removeKeys) — add a small branch.
- Prefer literal flags and const tuples to maximize inference; avoid local type assertions.

## 8) CI

- Keep tsd tests alongside demo examples; ensure they run in `npm run typecheck`.
- Demo CI should continue to run lint/tests/docs alongside typecheck.
