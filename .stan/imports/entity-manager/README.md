# entity-manager

[![npm version](https://img.shields.io/npm/v/@karmaniverous/entity-manager.svg)](https://www.npmjs.com/package/@karmaniverous/entity-manager) ![Node Current](https://img.shields.io/node/v/@karmaniverous/entity-manager) <!-- TYPEDOC_EXCLUDE --> [![docs](https://img.shields.io/badge/docs-website-blue)](https://docs.karmanivero.us/entity-manager) [![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/entity-manager/tree/main/CHANGELOG.md)<!-- /TYPEDOC_EXCLUDE --> [![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/entity-manager/tree/main/LICENSE.md)

Entity Manager implements rational indexing & cross‑shard querying at scale in your NoSQL database so you can focus on application logic. It is provider‑agnostic (great fit for DynamoDB) and TypeScript‑first with strong types and runtime validation.

Key links:

- Docs: https://docs.karmanivero.us/entity-manager
- Discussions: https://github.com/karmaniverous/entity-manager/discussions

## Why this library?

Modern NoSQL puts the burden of indexing, sharding, and pagination on the application. Entity Manager gives you:

- Values‑first configuration with runtime validation (Zod) and best‑in‑class inference.
- Token‑aware and index‑aware types end‑to‑end (entities, keys, page keys, queries).
- Deterministic sharding with a time‑based scale‑up schedule.
- Cross‑shard, multi‑index query orchestration with dedupe and sorting.
- Dehydration/rehydration of page keys to pass a single compact token between calls.

## Install

```bash
npm install @karmaniverous/entity-manager
# optional (tests/demo helpers)
npm install --save-dev @karmaniverous/mock-db
```

## DX highlights

- Values‑first + schema‑first config:
  - Use a config literal (prefer `as const` and `satisfies`) to preserve literal tokens.
  - Optionally provide Zod schemas (`entitiesSchema`) to infer entity shapes without generics.
- Projection‑aware typing (type‑only K):
  - Pass attributes as a const tuple (K) through your query types to narrow result items to Pick<…> of those properties.
  - No runtime change; adapters execute projections. Adapters should auto‑include `uniqueProperty` and any explicit sort keys when callers omit them to preserve dedupe/sort invariants.
- Index‑aware typing (values‑first config literal “CF” and captured config “CC” helpers):
  - CF (values‑first config literal): drive index token unions and page‑key narrowing directly from a values‑first config literal (`QueryOptionsByCF`, `ShardQueryMapByCF`).
  - CC (Captured Config): derive index tokens from a captured config type while reusing CF for narrowing (`QueryOptionsByCC`, `ShardQueryMapByCC`).
- Token‑aware helpers:
  - `addKeys`, `getPrimaryKey`, `removeKeys` narrow types by entity token (no casts).
- Index‑aware page keys (optional CF channel):
  - Provide a values‑first config literal (CF) with `indexes` and get typed page keys per index.
  - Use `QueryOptionsByCF` and `ShardQueryMapByCF` to derive index token unions directly from CF.
- CC-based DX sugar (values-first captured config):
  - Use `QueryOptionsByCC` and `ShardQueryMapByCC` to derive index token unions from a captured config type (via `IndexTokensFrom`), while still benefiting from page-key narrowing.

## Quick start (values‑first + schema‑first)

```ts
import { z } from 'zod';
import {
  createEntityManager,
  defaultTranscodes,
} from '@karmaniverous/entity-manager';

// 1) Schema-first entity shapes (non-generated fields only)
const userSchema = z.object({
  userId: z.string(), // unique property
  created: z.number(), // timestamp property
  updated: z.number().optional(),
  firstNameCanonical: z.string(),
  lastNameCanonical: z.string(),
});

// 2) Values-first config literal (prefer `as const`)
const config = {
  hashKey: 'hashKey2',
  rangeKey: 'rangeKey',
  generatedProperties: {
    sharded: {
      userPK: ['userId'] as const,
    },
    unsharded: {
      firstNameRK: ['firstNameCanonical', 'lastNameCanonical'] as const,
      lastNameRK: ['lastNameCanonical', 'firstNameCanonical'] as const,
    },
  },
  propertyTranscodes: {
    userId: 'string',
    created: 'timestamp',
    updated: 'timestamp',
    firstNameCanonical: 'string',
    lastNameCanonical: 'string',
  },
  indexes: {
    created: { hashKey: 'hashKey2', rangeKey: 'created' },
    userCreated: { hashKey: 'userPK', rangeKey: 'created' },
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
    lastName: { hashKey: 'hashKey2', rangeKey: 'lastNameRK' },
  } as const,
  entities: {
    user: {
      uniqueProperty: 'userId',
      timestampProperty: 'created',
      shardBumps: [{ timestamp: Date.now(), charBits: 2, chars: 1 }],
    },
  },
  entitiesSchema: { user: userSchema },
  transcodes: defaultTranscodes,
} as const;

// 3) Create the manager — types captured from values, shapes from schemas
const manager = createEntityManager(config);
```

### Token‑aware helpers

```ts
// Input item (no generated keys yet)
const user = {
  userId: 'u1',
  created: Date.now(),
  firstNameCanonical: 'lee',
  lastNameCanonical: 'zhang',
};

// Add generated keys (hashKey/rangeKey + index tokens)
const record = manager.addKeys('user', user);

// Compute one or more primary keys
const keys = manager.getPrimaryKey('user', { userId: 'u1' });

// Strip generated keys after read
const item = manager.removeKeys('user', record);
```

Types narrow automatically from the entity token (`'user'`). No casts required.

## Index‑aware querying (values‑first config literal, “CF” channel)

When you author a values‑first config literal with `indexes` (prefer `as const`), Entity Manager can:

- Constrain `shardQueryMap` keys to the index key union.
- Narrow page‑key shapes per index (only its component tokens).
- Derive ITS (index token subset) automatically from CF via `QueryOptionsByCF` and `ShardQueryMapByCF`.

```ts
import type {
  ShardQueryFunction,
  ShardQueryMapByCF,
  QueryOptionsByCF,
} from '@karmaniverous/entity-manager';

// CF: capture index tokens from a values-first literal
const cf = {
  indexes: {
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
    lastName: { hashKey: 'hashKey2', rangeKey: 'lastNameRK' },
  },
} as const;
type CF = typeof cf;

// SQFs are typed; pageKey is narrowed to index components per IT
const firstNameSQF: ShardQueryFunction<
  MyConfigMap,
  'user',
  'firstName',
  CF
> = async (hashKey, pageKey, pageSize) => ({ count: 0, items: [], pageKey });
const lastNameSQF: ShardQueryFunction<
  MyConfigMap,
  'user',
  'lastName',
  CF
> = async (hashKey, pageKey, pageSize) => ({ count: 0, items: [], pageKey });

// CF-aware shardQueryMap — only 'firstName' | 'lastName' allowed
const shardQueryMap: ShardQueryMapByCF<MyConfigMap, 'user', CF> = {
  firstName: firstNameSQF,
  lastName: lastNameSQF,
};

// Derive ITS from CF for options
const options: QueryOptionsByCF<MyConfigMap, 'user', CF> = {
  entityToken: 'user',
  item: {},
  shardQueryMap,
  limit: 50,
  pageSize: 10,
};

const result = await manager.query(options);
// result.pageKeyMap is a compact string — pass it to the next call’s options.pageKeyMap
```

### Captured Config (“CC”) aliases

You can also derive ITS (index token subset) directly from a values‑first captured config type (CC) using `QueryOptionsByCC` and `ShardQueryMapByCC`. This mirrors the CF helpers but drives ITS from the CC type (via `IndexTokensFrom`) and passes the same CC through the CF channel for page‑key narrowing.

```ts
import type {
  ShardQueryFunction,
  ShardQueryMapByCC,
  QueryOptionsByCC,
} from '@karmaniverous/entity-manager';

// A values-first config literal capturing index tokens (the same shape used for CF)
const cc = {
  indexes: {
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
    lastName: { hashKey: 'hashKey2', rangeKey: 'lastNameRK' },
  },
} as const;
type CC = typeof cc;

// Reuse typed SQFs (pageKey narrowed per index)
const firstNameSQF: ShardQueryFunction<
  MyConfigMap,
  'user',
  'firstName',
  CC
> = async (hashKey, pageKey, pageSize) => ({ count: 0, items: [], pageKey });
const lastNameSQF: ShardQueryFunction<
  MyConfigMap,
  'user',
  'lastName',
  CC
> = async (hashKey, pageKey, pageSize) => ({ count: 0, items: [], pageKey });

// CC-aware shardQueryMap — only 'firstName' | 'lastName' allowed
const shardQueryMapCC: ShardQueryMapByCC<MyConfigMap, 'user', CC> = {
  firstName: firstNameSQF,
  lastName: lastNameSQF,
};
const optionsCC: QueryOptionsByCC<MyConfigMap, 'user', CC> = {
  entityToken: 'user',
  item: {},
  shardQueryMap: shardQueryMapCC,
};
const resultCC = await manager.query(optionsCC);
```

Notes:

- Entity Manager enumerates hash‑key space for the time window, rehydrates page keys (when present), executes shard queries in parallel (throttled), dedupes by unique property, sorts, and dehydrates a new pageKeyMap.
- For provider integration, the SQF lambda encapsulates the platform‑specific query for one index + shard page. See tests and entity‑client‑dynamodb for examples.

## Projection‑aware typing (K)

Entity Manager supports a type‑only projection channel K that narrows result item shapes when a provider adapter projects a subset of attributes at runtime. Pass your attributes as a const tuple and thread K through `ShardQueryFunction/Map`, `QueryOptions`, and `QueryResult`.

```ts
import type {
  ConfigMap,
  EntityItemByToken,
  QueryOptions,
  QueryResult,
  ShardQueryFunction,
  ShardQueryMap,
} from '@karmaniverous/entity-manager';

// Minimal entities (example)
interface Email {
  created: number;
  email: string;
  userId: string;
}
interface User {
  beneficiaryId: string;
  created: number;
  firstNameCanonical: string;
  lastNameCanonical: string;
  phone?: string;
  updated: number;
  userId: string;
}

type MyConfigMap = ConfigMap<{
  EntityMap: { email: Email; user: User };
  HashKey: 'hashKey2';
  RangeKey: 'rangeKey';
  ShardedKeys: 'beneficiaryPK' | 'userPK';
  UnshardedKeys: 'firstNameRK' | 'lastNameRK' | 'phoneRK';
  TranscodedProperties:
    | 'beneficiaryId'
    | 'created'
    | 'email'
    | 'firstNameCanonical'
    | 'lastNameCanonical'
    | 'phone'
    | 'updated'
    | 'userId';
}>;

// CF capturing a single index
const cf = {
  indexes: {
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
  },
} as const;
type CF = typeof cf;

// Projection attributes as const tuple — narrows K.
const attrs = ['userId', 'created'] as const;
type K = typeof attrs;

// A typed SQF: pageKey narrows via CF; items narrow via K (type-only).
const sqf: ShardQueryFunction<MyConfigMap, 'user', 'firstName', CF, K> = async (
  _hashKey,
  _pageKey,
  _pageSize,
) => ({
  count: 0,
  items: [], // never[] is assignable to the projected array
  pageKey: _pageKey,
});

// ShardQueryMap carrying CF and K.
const map: ShardQueryMap<MyConfigMap, 'user', 'firstName', CF, K> = {
  firstName: sqf,
};
const options: QueryOptions<MyConfigMap, 'user', 'firstName', CF, K> = {
  entityToken: 'user',
  item: {},
  shardQueryMap: map,
};
const result: QueryResult<MyConfigMap, 'user', 'firstName', K> =
  await manager.query(options);
// result.items: Pick<EntityItemByToken<MyConfigMap, 'user'>, 'userId' | 'created'>[]
```

Notes:

- K is a type‑only channel; it does not change runtime behavior. Providers (e.g., DynamoDB adapters) execute projections.
- Dedupe/sort invariants: Entity Manager dedupes by `uniqueProperty` and applies `QueryOptions.sortOrder`. If your adapter projects attributes, ensure it auto‑includes `uniqueProperty` and any explicit sort keys when callers omit them from K.

## Page keys in a nutshell

- `rehydratePageKeyMap` decodes a dehydrated array (compressed string) into a two‑layer map of `{ indexToken: { hashKeyValue: pageKey | undefined } }`.
- `dehydratePageKeyMap` performs the inverse and emits a compact array (compressed in `query()`).
- You rarely call these directly — `query()` composes them for you — but the API is exposed for advanced flows.

## ESM / CJS

```ts
// ESM
import {
  createEntityManager,
  defaultTranscodes,
} from '@karmaniverous/entity-manager';

// CJS
const {
  createEntityManager,
  defaultTranscodes,
} = require('@karmaniverous/entity-manager');
```

## Logging

Entity Manager logs debug and error details via the injected logger (defaults to `console`).

```ts
const logger = { debug: () => undefined, error: console.error };
const manager = createEntityManager(config, logger);
```

## Types you’ll reach for

- Values/schema capture
  - `createEntityManager(config, logger?)`
  - `ConfigInput` (values‑first), `CapturedConfigMapFrom`, `EntitiesFromSchema`
- Token aware
  - `EntityToken<CC>`, `EntityItemByToken<CC, ET>`, `EntityRecordByToken<CC, ET>`
- Index aware (values‑first config literal, “CF” channel)
  - `PageKeyByIndex<CC, ET, IT, CF>`
  - `ShardQueryFunction<CC, ET, IT, CF>`, `ShardQueryMap<CC, ET, ITS, CF>`
  - `QueryOptions<CC, ET, ITS, CF>`, `QueryResult<CC, ET, ITS>`
  - DX sugar: `IndexTokensOf<CF>`, `QueryOptionsByCF`, `ShardQueryMapByCF`, `IndexTokensFrom<CC>`, `QueryOptionsByCC`, `ShardQueryMapByCC`
- Projection helpers
  - `KeysFrom<K>`
  - `Projected<T, K>`
  - `ProjectedItemByToken<CC, ET, K>`

See the full API: https://docs.karmanivero.us/entity-manager

## Scripts (repo)

- build: rollup outputs ESM/CJS + .d.ts
- test: vitest with coverage
- lint: ESLint (type‑aware) + Prettier
- docs: TypeDoc
- typecheck: tsc + tsd (type‑level tests)

## License

BSD‑3‑Clause (see package.json).

---

Built for you with ❤️ on Bali! Find more great tools & templates on [my GitHub Profile](https://github.com/karmaniverous).
