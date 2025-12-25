---
title: Getting Started
---

# Getting Started

This guide shows a minimal workflow to initialize an EntityClient, create a table, and perform simple CRUD.

Install

```bash
npm i @karmaniverous/entity-client-dynamodb
```

Wire an EntityClient

```ts
import {
  EntityClient,
  generateTableDefinition,
} from '@karmaniverous/entity-client-dynamodb';
import { EntityManager } from '@karmaniverous/entity-manager';

// Assume you have a values-first (config-literal) EntityManager; see "Type inference mental model"
declare const entityManager: EntityManager<any>;

const client = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'local',
  // endpoint/credentials can be set for local development
});
```

Create the table from your EntityManager config

```ts
await client.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...generateTableDefinition(entityManager),
});
```

Put / Get

```ts
// Put a record (storage-facing shape)
await client.putItem({ hashKey2: 'h', rangeKey: 'r', a: 1 });

// Get a record (storage record; token-aware)
const out = await client.getItem('user', { hashKey2: 'h', rangeKey: 'r' });

// Convert to domain (strip keys)
const item = out.Item && client.entityManager.removeKeys('user', out.Item);
```

Next steps

- Read [EntityClient: CRUD and batches](./entityclient-and-crud.md) for record/batch operations (purge and transactions).
- Explore [Querying with QueryBuilder](./querying-with-querybuilder.md) for cross-shard, multi-index reads with projections.
- Learn about [Type inference mental model](./type-inference-model.md) to get the most from value-first typing.
- If you need versioned table lifecycle and data migration, see the [CLI Plugin](./cli/index.md).
