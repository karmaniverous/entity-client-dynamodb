---
title: Tables & Table Definition
---

# Tables & Table Definition

Generate a DynamoDB table definition directly from your EntityManager config and create the table via the client.

Generate the definition

```ts
import { generateTableDefinition } from '@karmaniverous/entity-client-dynamodb';

const def = generateTableDefinition(client.entityManager);
// def includes:
// - AttributeDefinitions (global & index tokens)
// - GlobalSecondaryIndexes (with projections resolved)
// - KeySchema
```

Create a table

```ts
await client.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...def,
});
```

Attribute typing helpers

If your transcodes include non-string types, you can control AttributeType mapping via the TranscodeAttributeTypeMap helpers.

```ts
import {
  defaultTranscodeAttributeTypeMap,
  type TranscodeAttributeTypeMap,
} from '@karmaniverous/entity-client-dynamodb';
// defaultTranscodeAttributeTypeMap maps numeric-like transcodes to 'N'
```

CLI Plugin

If you’re using the get-dotenv DynamoDB CLI plugin (recommended as a child of the shipped aws plugin), commands are invoked as `aws dynamodb ...` and config is keyed under `plugins["aws/dynamodb"]`.

```bash
mycli aws dynamodb generate --version 001
mycli aws dynamodb validate --version 001
```

Related

- [CLI Plugin – Table lifecycle](./cli/table-lifecycle.md) for YAML composition, validation, and create/delete/purge flows.
