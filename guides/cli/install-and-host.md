---
title: Install & Host Integration
---

# Install & Host Integration

Install the get-dotenv host (optional peer) and wire the DynamoDB plugin.

```bash
npm i -D @karmaniverous/get-dotenv@^8.0.0-0
```

Create a host CLI

```ts
// mycli.ts
import { createCli } from '@karmaniverous/get-dotenv/cli';
import { awsPlugin } from '@karmaniverous/get-dotenv/plugins';
import { dynamodbPlugin } from '@karmaniverous/entity-client-dynamodb/get-dotenv';

const run = createCli({
  alias: 'mycli',
  importMetaUrl: import.meta.url,
  compose: (p) => p.use(awsPlugin().use(dynamodbPlugin())),
});

await run(process.argv.slice(2));
```

Notes

- get-dotenv is an optional peer: consumers of the main entity-client entry do not need it. The plugin subpath requires get-dotenv 8.
- `importMetaUrl` is required by get-dotenv 8 so host identity and packaged config resolve from the host package, not from get-dotenv itself.
- The expected composition is as a child of the shipped `aws` plugin, so commands live under the `aws dynamodb` path.
- Plugin config is keyed by realized mount path; when nested under aws, the config key is `"aws/dynamodb"` (not `"dynamodb"`).

Minimal config (getdotenv.config.json; aws parent)

```json
{
  "plugins": {
    "aws/dynamodb": {
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

Next

- See [Versioned layout and tokens](./versioned-layout.md) for the files under tables/NNN.
- See [Table lifecycle](./table-lifecycle.md) for generate/validate/create/delete/purge flows.
- See [Data migration](./migrate.md) for step discovery, transforms, and progress.
