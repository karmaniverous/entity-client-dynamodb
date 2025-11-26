# entity-client-dynamodb

[![npm version](https://img.shields.io/npm/v/@karmaniverous/entity-client-dynamodb.svg)](https://www.npmjs.com/package/@karmaniverous/entity-client-dynamodb) ![Node Current](https://img.shields.io/node/v/@karmaniverous/entity-client-dynamodb) <!-- TYPEDOC_EXCLUDE --> [![docs](https://img.shields.io/badge/docs-website-blue)](https://docs.karmanivero.us/entity-client-dynamodb) [![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/entity-client-dynamodb/tree/main/CHANGELOG.md)<!-- /TYPEDOC_EXCLUDE --> [![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/entity-client-dynamodb/tree/main/LICENSE.md)

Type-safe DynamoDB (SDK v3) client for single-table design with powerful querying, great DX, and first-class TypeScript.

Install

```bash
npm i @karmaniverous/entity-client-dynamodb
```

Quick start (tiny)

```ts
import {
  EntityClient,
  generateTableDefinition,
} from '@karmaniverous/entity-client-dynamodb';
import { EntityManager } from '@karmaniverous/entity-manager';

declare const entityManager: EntityManager<any>;

const client = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'local',
});

// One-time table creation (from EntityManager config)
await client.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...generateTableDefinition(entityManager),
});

// Put / Get (records; strip keys to get domain)
await client.putItem({ hashKey2: 'h', rangeKey: 'r', a: 1 });
const out = await client.getItem({ hashKey2: 'h', rangeKey: 'r' });
const item = out.Item && client.entityManager.removeKeys('user', out.Item);
```

Documentation (guides)

- [Getting Started](./guides/getting-started.md) - Install, wire, and make your first calls.
- [EntityClient: CRUD and Batches](./guides/entityclient-and-crud.md) - Record/recordset operations with strong types.
- [Querying with QueryBuilder](./guides/querying-with-querybuilder.md) - Cross-shard, multi-index querying and projections.
- [Tables & Table Definition](./guides/tables-and-definition.md) - Generate AttributeDefinitions/GSIs/KeySchema.
- [Type Inference Mental Model](./guides/type-inference-model.md) - Tokens, projection K, and config‑literal cf.
- [AWS X-Ray](./guides/aws-xray.md) - Enable tracing for the DynamoDB SDK client.

CLI Plugin

- [CLI Plugin](./guides/cli/index.md) - Index for install, versioned layout, table lifecycle, transforms, migration, config overlays, Serverless, and recipes.

API Reference

- [TypeDoc API](https://docs.karmanivero.us/entity-client-dynamodb) - Full API surface generated from the source.

License

BSD-3-Clause
