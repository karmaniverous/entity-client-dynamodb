# @karmaniverous/entity-client-dynamodb

[![npm version](https://img.shields.io/npm/v/@karmaniverous/entity-client-dynamodb.svg)](https://www.npmjs.com/package/@karmaniverous/entity-client-dynamodb) ![Node Current](https://img.shields.io/node/v/@karmaniverous/entity-client-dynamodb) <!-- TYPEDOC_EXCLUDE --> [![docs](https://img.shields.io/badge/docs-website-blue)](https://docs.karmanivero.us/entity-client-dynamodb) [![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/entity-client-dynamodb/tree/main/CHANGELOG.md)<!-- /TYPEDOC_EXCLUDE --> [![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/entity-client-dynamodb/tree/main/LICENSE.md)

EntityClient for AWS DynamoDB (SDK v3) with:

- Thin, typed wrapper over DynamoDBClient and DynamoDBDocument
- Enhanced batch processing (retries for unprocessed items)
- Seamless integration with [EntityManager](https://github.com/karmaniverous/entity-manager) for cross-shard, multi-index querying
- First-class TypeScript types and docs

If you are using the EntityManager ecosystem for single-table DynamoDB design, this package provides a practical, ergonomic client layer you can use directly in services, tests, and scripts.

---

## Installation

- Node 18+ recommended
- TypeScript 5+ recommended

Install from npm:

```bash
npm i @karmaniverous/entity-client-dynamodb
```

This package bundles AWS SDK v3 client dependencies; you do not need to install them separately.

---

## Quick start

Below is a minimal, end-to-end example using an existing EntityManager configuration. See the EntityManager docs for how to build `entityManager`.

```ts
import {
  EntityClient,
  QueryBuilder,
  generateTableDefinition,
} from '@karmaniverous/entity-client-dynamodb';
import { EntityManager } from '@karmaniverous/entity-manager';

// Assume you already have a typed, validated EntityManager instance.
declare const entityManager: EntityManager<any>;

// Create the client.
const entityClient = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'local',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
});

// Optionally create a table from your EntityManager config.
await entityClient.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...generateTableDefinition(entityManager),
});

// Put & get a record (assumes your config hashKey/rangeKey are set).
await entityClient.putItem({ hashKey2: 'u1', rangeKey: 'rk1', first: 'Ada' });
const { Item } = await entityClient.getItem({
  hashKey2: 'u1',
  rangeKey: 'rk1',
});
console.log(Item); // { hashKey2: 'u1', rangeKey: 'rk1', first: 'Ada' }

// Query across shards using QueryBuilder + EntityManager.
const builder = new QueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});

// Example range condition (see QueryBuilder section for more)
builder.addRangeKeyCondition('created', {
  property: 'created',
  operator: 'between',
  value: { from: 1700000000000, to: 1900000000000 },
});

const shardQueryMap = builder.build();
const { items, pageKeyMap } = await entityManager.query({
  entityToken: 'user',
  item: {}, // only required fields to derive alternate hash keys
  shardQueryMap,
  pageSize: 25,
});
console.log(items.length, pageKeyMap);
```

---

## Creating & deleting tables

Use your EntityManager configuration to generate a DynamoDB table definition, then create/delete it with convenient waiters:

```ts
import { generateTableDefinition } from '@karmaniverous/entity-client-dynamodb';

// Create
const { waiterResult: createWaiter } = await entityClient.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...generateTableDefinition(entityManager),
});
console.log(createWaiter.state); // 'SUCCESS'

// Delete
const { waiterResult: deleteWaiter } = await entityClient.deleteTable();
console.log(deleteWaiter.state); // 'SUCCESS'
```

The waiter timeout is configurable:

```ts
await entityClient.createTable(
  {
    /* ... */
  },
  { maxWaitTime: 120 },
);
```

---

## Basic CRUD

### putItem

```ts
// Overload 1: provide the Item directly
await entityClient.putItem({ hashKey2: 'h1', rangeKey: 'r1', a: 1 });

// Overload 2: pass a full PutCommandInput (Item must match your record type)
await entityClient.putItem({
  Item: { hashKey2: 'h2', rangeKey: 'r2', a: 2 },
  ConditionExpression: 'attribute_not_exists(#rk)',
  ExpressionAttributeNames: { '#rk': 'rangeKey' },
});
```

### getItem

```ts
// Full item
const full = await entityClient.getItem({ hashKey2: 'h1', rangeKey: 'r1' });
console.log(full.Item);

// Projection with attribute list
const projected = await entityClient.getItem(
  { hashKey2: 'h1', rangeKey: 'r1' },
  ['a'],
);
console.log(projected.Item); // { a: 1 }
```

### deleteItem

```ts
await entityClient.deleteItem({ hashKey2: 'h1', rangeKey: 'r1' });
```

---

## Batch operations

### putItems

```ts
await entityClient.putItems([
  { hashKey2: 'h', rangeKey: '1' },
  { hashKey2: 'h', rangeKey: '2' },
  { hashKey2: 'h', rangeKey: '3' },
]);
```

The client will retry unprocessed items until exhausted (configurable via `batchProcessOptions` on the EntityClient constructor and per-call overrides).

### deleteItems

```ts
await entityClient.deleteItems([
  { hashKey2: 'h', rangeKey: '1' },
  { hashKey2: 'h', rangeKey: '2' },
  { hashKey2: 'h', rangeKey: '3' },
]);
```

### purgeItems

Delete every item from the table (scans, then batched deletes). Returns number of items purged:

```ts
const count = await entityClient.purgeItems();
console.log(`Purged ${count} items`);
```

---

## Transactions

Use DynamoDB transactional writes for atomic multi-item updates:

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

## Querying with QueryBuilder + EntityManager

The QueryBuilder composes shard-friendly, index-specific query functions. Use it with `EntityManager.query` to run cross-shard, multi-index queries with typed page-key hydration.

```ts
import { QueryBuilder } from '@karmaniverous/entity-client-dynamodb';

const builder = new QueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2', // your config HashKey token
});

// Add a range key condition (see QueryBuilder API for all operators)
builder.addRangeKeyCondition('created', {
  property: 'created',
  operator: 'between',
  value: { from: 1700000000000, to: 1900000000000 },
});

// Add filter conditions (optional)
builder.addFilterCondition('updated', {
  property: 'updated',
  operator: '>=',
  value: 1700000000000,
});

const shardQueryMap = builder.build();

const { items, pageKeyMap } = await entityManager.query({
  entityToken: 'user',
  item: {}, // minimal fields to derive alternate hash keys when needed
  shardQueryMap,
  pageSize: 25, // per-shard page size
  // limit: 100, // optional cross-shard max
});
```

To fetch the next page, pass the returned `pageKeyMap` back into `EntityManager.query`.

---

## Table definition generation

`generateTableDefinition(entityManager)` builds a partial `CreateTableCommandInput` based on your EntityManager config:

- AttributeDefinitions (including global keys plus all index components)
- GlobalSecondaryIndexes (with projections resolved)
- KeySchema (global hash/range keys)

Use it together with your desired throughput/billing options:

```ts
const definition = generateTableDefinition(entityManager);
await entityClient.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...definition,
});
```

---

## AWS X-Ray

If you run in an environment with a running X-Ray daemon (`AWS_XRAY_DAEMON_ADDRESS`), you can enable X-Ray capture for the underlying DynamoDB client:

```ts
const entityClient = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'us-east-1',
  enableXray: true,
});
```

---

## DynamoDB Local (for testing)

This repo’s tests run against [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) inside Docker. See the test suite for a reference setup.

For your own projects, point EntityClient at the emulator:

```ts
const entityClient = new EntityClient({
  entityManager,
  tableName: 'DevTable',
  region: 'local',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
});
```

---

## Exported surface (high level)

- EntityClient class (and related option types)
- QueryBuilder and helpers for conditions and index parameters
- Tables utilities:
  - generateTableDefinition
  - TranscodeAttributeTypeMap and defaultTranscodeAttributeTypeMap
- Low-level helper: getDocumentQueryArgs (used internally by QueryBuilder)

See [API Docs](https://docs.karmanivero.us/entity-client-dynamodb) for details.

---

## License

BSD-3-Clause

---

Built for you with ❤️ on Bali! Find more great tools & templates on [my GitHub Profile](https://github.com/karmaniverous).
