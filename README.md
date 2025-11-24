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

### Token-aware typed reads (no generics)

Strong inference without casts — pass a literal entity token. Reads always return records (storage-facing shapes). Strip keys in handlers when you want domain objects using EntityManager.

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

// Produce a domain object by stripping keys in your handler
const item =
  rec.Item && entityClient.entityManager.removeKeys('user', rec.Item);

// Token-aware batch get (records)
const many = await entityClient.getItems('user', [
  { hashKey2: 'h1', rangeKey: 'r1' },
  { hashKey2: 'h1', rangeKey: 'r2' },
]);

// Domain items (strip generated/global keys)
const domainItems = entityClient.entityManager.removeKeys('user', many.items);
```

Note:

- Token-aware reads infer types from your literal entity token.
- When you want domain items, strip keys via entityClient.entityManager.removeKeys in your handler.

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

// Note: When CF is provided, page keys are typed per index (PageKeyByIndex),
// and ShardQueryFunction will accept a pageKey narrowed to that index token.

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
  - Tuple-based projection narrowing via const attribute lists (record shapes)
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
- “Strip keys in handlers when you want domain objects”
  - Call `entityClient.entityManager.removeKeys(entityToken, records)` to return domain shapes.
- “Config literal (cf) narrows page keys by index”
  - Pass your config literal to createQueryBuilder for index/page-key correctness.

---

## Get-dotenv plugin (dynamodb)

This package ships an optional get-dotenv plugin that provides a host-aware CLI for versioned DynamoDB table lifecycle and data migration.

- Subpath export: import the plugin from the dedicated subpath (no impact on application imports).
  - ESM: `@karmaniverous/entity-client-dynamodb/get-dotenv`
  - CJS paths mirror dist outputs; types are provided via the package root.
- Plugin layout:
  - Source: `src/get-dotenv/**`
  - Commands: `dynamodb generate|validate|create|delete|purge|migrate`
  - Services: versioned layout helpers, EM loader (fallback), YAML composition/validation, migration chaining

Install the host (optional peer):

```bash
npm i -D @karmaniverous/get-dotenv
```

Use from a get-dotenv host (plugin-first)

```ts
// mycli.ts
import { createCli } from '@karmaniverous/get-dotenv';
import { dynamodbPlugin } from '@karmaniverous/entity-client-dynamodb/get-dotenv';

await createCli({ alias: 'mycli' })
  // install the plugin under the "dynamodb" namespace
  .use(dynamodbPlugin)
  .run(process.argv.slice(2));
```

Minimal config (getdotenv.config.json)

```json
{
  "plugins": {
    "dynamodb": {
      "tablesPath": "./tables",
      "tokens": {
        "table": "table",
        "entityManager": "entityManager",
        "transform": "transform"
      }
    }
  }
}
```

Subcommands (namespaced under “dynamodb”)

- generate: compose or refresh `tables/NNN/table.yml` (comment‑preserving)
- validate: compare generated sections against the resolved EM
- create: create table from YAML (validate or refresh generated sections)
- delete: delete table (waiter)
- purge: scan and delete all items
- migrate: stream data across version steps with optional transforms

Examples

```bash
# compose YAML for version 001 (from tables/table.template.yml if present)
mycli dynamodb generate --version 001

# validate generated YAML sections vs EM
mycli dynamodb validate --version 001

# create a table (validate by default; waiter with 60s max)
mycli dynamodb create --version 001 --max-seconds 60

# create with refresh of generated sections and a one-off TableName override
mycli dynamodb create --version 001 \
  --refresh-generated \
  --table-name-override MyTable \
  --max-seconds 120

# delete a table (confirmation required; use --force in CI)
mycli dynamodb delete --table-name MyTable --version 001 --max-seconds 30 --force

# purge all items from a table (confirmation required; use --force in CI)
mycli dynamodb purge --table-name MyTable --version 001 --force

# migrate data across versions with optional concurrency and progress
mycli dynamodb migrate \
  --source-table Source \
  --target-table Target \
  --from-version 001 \
  --to-version 002 \
  --page-size 100 \
  --limit 10000 \
  --transform-concurrency 4 \
  --progress-interval-ms 2000 \
  --force
```

### Authoring transforms

When migrating between versions, you can add an optional per-step transform module to control how records move from the previous version to the next. Author transforms in `tables/NNN/transform.ts` using the `defineTransformMap` helper for strong typing. Omitted entities fall back to the default chain: `prev.removeKeys → next.addKeys`.

Example (`tables/002/transform.ts`):

```ts
import { defineTransformMap } from '@karmaniverous/entity-client-dynamodb/get-dotenv';

// Import types from your local EntityManager modules for this step.
// These are the value-first Config types you export in your versioned files.
import type { ConfigMap as PrevCM } from '../001/entityManager';
import type { ConfigMap as NextCM } from './entityManager';

export default defineTransformMap<PrevCM, NextCM>({
  // Per-entity handler; may be async.
  // Return:
  // - undefined → drop the record
  // - one item/record → migrate one
  // - array of items/records → fan-out
  user: async (record, { prev, next }) => {
    // Convert storage record → domain item using the previous EM
    const item = prev.removeKeys('user', record);

    // Optional domain mutations between versions...
    // e.g., normalize or backfill a property
    // item.foo = item.foo ?? 'default';

    // Convert domain item → storage record for the next EM
    return next.addKeys('user', item);
  },
});
```

Notes:
- Handlers are per-entity. Entities you don’t list use the default chain.
- You can also return an array to fan-out or return `undefined` to drop a record.
- Cross-entity fan-out is not supported in v1; outputs are interpreted for the same entity token.

---

## License

BSD-3-Clause

---

Built for you with ❤️ on Bali! Find more great tools & templates on [my GitHub Profile](https://github.com/karmaniverous).
