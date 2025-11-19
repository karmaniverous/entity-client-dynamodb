# @karmaniverous/entity-client-dynamodb

[![npm version](https://img.shields.io/npm/v/@karmaniverous/entity-client-dynamodb.svg)](https://www.npmjs.com/package/@karmaniverous/entity-client-dynamodb) ![Node Current](https://img.shields.io/node/v/@karmaniverous/entity-client-dynamodb) <!-- TYPEDOC_EXCLUDE --> [![docs](https://img.shields.io/badge/docs-website-blue)](https://docs.karmanivero.us/entity-client-dynamodb) [![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/entity-client-dynamodb/tree/main/CHANGELOG.md)<!-- /TYPEDOC_EXCLUDE --> [![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/entity-client-dynamodb/tree/main/LICENSE.md)

EntityClient for AWS DynamoDB (SDK v3) with:

- Thin, typed wrapper over DynamoDBClient and DynamoDBDocument
- Enhanced batch processing (retries for unprocessed items)
- Seamless integration with [EntityManager](https://github.com/karmaniverous/entity-manager) for cross-shard, multi-index querying
- First-class TypeScript types and DX-focused factories/overloads

If you use the EntityManager ecosystem for single-table DynamoDB design, this package gives you a practical, ergonomic client with strong inference and minimal boilerplate.

---

## Mental model (DX first)

- EntityManager defines your schema, generated properties, and query strategy.
- EntityClient is a DynamoDB adapter:
  - CRUD and batch ops with strong typing
  - Optional page-key decoding and key stripping when you want domain objects
- QueryBuilder composes cross-shard index queries:
  - Token-aware and index-aware types
  - Zero generics at call sites via a factory

You should not need to write type parameters (<...>) at call sites. Pass values (entityToken, config literals), and types flow.

---

## Installation

- Node 18+ recommended
- TypeScript 5+ recommended

```bash
npm i @karmaniverous/entity-client-dynamodb
```

---

## Quick start

Assume you already have a typed EntityManager configured.

```ts
import { EntityClient } from '@karmaniverous/entity-client-dynamodb';
import { EntityManager } from '@karmaniverous/entity-manager';

// Assume a typed EntityManager instance exists.
declare const entityManager: EntityManager<any>;

const entityClient = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'local',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
});
```

### Create a table from your EntityManager config

```ts
import { generateTableDefinition } from '@karmaniverous/entity-client-dynamodb';

await entityClient.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...generateTableDefinition(entityManager),
});
```

### Basic CRUD

```ts
// Put
await entityClient.putItem({ hashKey2: 'h1', rangeKey: 'r1', a: 1 });

// Get (full item)
const full = await entityClient.getItem({ hashKey2: 'h1', rangeKey: 'r1' });

// Get (projection)
const projected = await entityClient.getItem(
  { hashKey2: 'h1', rangeKey: 'r1' },
  ['a'],
);
```

### Token-aware typed reads (no generics; optional key stripping)

Strong inference without casts — pass a literal entity token. You can also request key stripping (removeKeys) to return domain objects.

```ts
// Token-aware single get (record)
const rec = await entityClient.getItem('user', {
  hashKey2: 'h1',
  rangeKey: 'r1',
});

// Token-aware single get (record, projection)
const recProj = await entityClient.getItem(
  'user',
  { hashKey2: 'h1', rangeKey: 'r1' },
  ['a'],
);

// Token-aware single get (domain object: remove generated/global keys)
const it = await entityClient.getItem(
  'user',
  { hashKey2: 'h1', rangeKey: 'r1' },
  { removeKeys: true },
);

// Token-aware batch get (records)
const many = await entityClient.getItems('user', [
  { hashKey2: 'h1', rangeKey: 'r1' },
  { hashKey2: 'h1', rangeKey: 'r2' },
]);

// Token-aware batch get (domain objects)
const manyDomain = await entityClient.getItems(
  'user',
  [
    { hashKey2: 'h1', rangeKey: 'r1' },
    { hashKey2: 'h1', rangeKey: 'r2' },
  ],
  { removeKeys: true },
);
```

Note:

- Without a token, removeKeys is ignored (we do not guess the entity).
- With a token and removeKeys: true, items are stripped to your domain shape.

---

## Querying (cross-shard, multi-index) with QueryBuilder

Use the factory to infer ET automatically. Optionally pass your config literal (cf) to derive index tokens (ITS) and per-index page-key typing.

```ts
import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';

// Minimal: infer ET from entityToken; ITS defaults to string
const qb = createQueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});

// Optional CF: derive ITS from cf.indexes and narrow page keys by index
const qb2 = createQueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
  cf: myConfigLiteral, // preserves keys with `as const`
});

// Add conditions
qb.addRangeKeyCondition('created', {
  property: 'created',
  operator: 'between',
  value: { from: 1700000000000, to: 1900000000000 },
});

// Build the shard query map & execute via EntityManager.query
const shardQueryMap = qb.build();

const { items, pageKeyMap } = await entityManager.query({
  entityToken: 'user',
  item: {}, // minimal fields to derive alternate keys when needed
  shardQueryMap,
  pageSize: 25,
});
```

To fetch the next page, pass the returned `pageKeyMap` back into `EntityManager.query`.

---

## Projections with QueryBuilder (adapter policy)

- You can set projections per index on the builder. At runtime the adapter emits a DynamoDB ProjectionExpression and:
  - auto-includes the entity’s uniqueProperty (used for dedupe),
  - auto-includes any explicit sort keys provided via QueryOptions.sortOrder.
- This preserves dedupe/sort invariants when callers ask for a subset.

Example:

```ts
const qb = createQueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});

qb.setProjection('created', ['created'] as const);
```

---

## Projections and scan direction (ergonomics)

QueryBuilder provides a few helper methods to make common DynamoDB options easy while preserving the K type channel on results:

- setProjection(indexToken, attributes)
  - Runtime: emits a ProjectionExpression for the index.
  - Type: narrows the builder’s K to the provided attribute tuple (const).
- setProjectionAll(indices, attributes)
  - Runtime: applies the same ProjectionExpression across a set of index tokens.
  - Type: narrows K to the provided attribute tuple, uniformly across the builder.
- resetProjection(indexToken) / resetAllProjections()
  - Runtime: clears projection(s), querying full items again.
  - Type: widens K back to unknown (full item shape).
- setScanIndexForward(indexToken, boolean)
  - Runtime: sets the DynamoDB ScanIndexForward flag for the index.
  - Type: no change (pure query-direction toggle).

Example:

```ts
import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';

const qb = createQueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});

// Uniform projection to the 'created' index (and possibly others)
qb.setProjectionAll(['created'], ['created'] as const);

// Reverse chronological results on the 'created' index
qb.setScanIndexForward('created', false);

const shardQueryMap = qb.build();
const { items } = await entityManager.query({
  entityToken: 'user',
  item: {},
  shardQueryMap,
  pageSize: 25,
});
// items: Pick<EntityItemByToken<..., 'user'>, 'created'>[]

// Later: widen K back to unknown (full item shape)
const qbFull = qb.resetAllProjections();
```

Note: Runtime projection policy (adapter-level) will auto-include the entity uniqueProperty and any explicit sort keys in the ProjectionExpression to preserve dedupe/sort invariants.

## Batch operations

```ts
// putItems
await entityClient.putItems([
  { hashKey2: 'h', rangeKey: '1' },
  { hashKey2: 'h', rangeKey: '2' },
]);

// deleteItems
await entityClient.deleteItems([
  { hashKey2: 'h', rangeKey: '1' },
  { hashKey2: 'h', rangeKey: '2' },
]);

// purge (scan + batched deletes). Returns number purged.
const count = await entityClient.purgeItems();
```

Transactions:

```ts
await entityClient.transactPutItems([
  { hashKey2: 'h', rangeKey: '10', x: 1 },
  { hashKey2: 'h', rangeKey: '11', x: 2 },
]);

await entityClient.transactDeleteItems([
  { hashKey2: 'h', rangeKey: '10' },
  { hashKey2: 'h', rangeKey: '11' },
]);
```

---

## Table definition generation

`generateTableDefinition(entityManager)` builds a partial `CreateTableCommandInput` based on your EntityManager config:

- AttributeDefinitions (global & index tokens)
- GlobalSecondaryIndexes (with projections resolved)
- KeySchema

Use it with your billing/throughput options:

```ts
const definition = generateTableDefinition(entityManager);
await entityClient.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...definition,
});
```

---

## AWS X-Ray

Enable X-Ray capture for the internal DynamoDB client when an X-Ray daemon is present.

```ts
const entityClient = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'us-east-1',
  enableXray: true,
});
```

---

## Types you’ll use most (re-exported here)

Types are re-exported for convenience:

```ts
import type {
  EntityToken,
  EntityItemByToken,
  EntityRecordByToken,
} from '@karmaniverous/entity-client-dynamodb';
```

When using tuple-based projection narrowing you can also import the Projected<T, A> helper:

```ts
import type { Projected } from '@karmaniverous/entity-client-dynamodb';
```

Note: Runtime re-exports (e.g., EntityManager) are intentionally not provided — import them from their source packages to keep module graphs clear.

---

## API surface (high level)

- EntityClient class (and options)
  - Token-aware getItem/getItems overloads
  - Optional key stripping with GetItemOptions / GetItemsOptions
- QueryBuilder and helpers for conditions and index parameters
  - Factory: createQueryBuilder (cf optional)
- Tables utilities:
  - generateTableDefinition
  - TranscodeAttributeTypeMap and defaultTranscodeAttributeTypeMap
- Low-level helper: getDocumentQueryArgs

See [API Docs](https://docs.karmanivero.us/entity-client-dynamodb) for details.

---

## Notes on inference and mental model

- “Token in → Narrowed type out”
  - Pass a literal entity token to get token-narrowed records.
- “RemoveKeys when you want domain objects”
  - In token-aware reads, set `removeKeys: true` to strip generated/global keys.
- “Config literal (cf) narrows page keys by index”
  - Pass your config literal to createQueryBuilder for index/page-key correctness.

---

## License

BSD-3-Clause

---

Built for you with ❤️ on Bali! Find more great tools & templates on [my GitHub Profile](https://github.com/karmaniverous).
