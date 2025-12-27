# STAN Assistant Guide — entity-client-dynamodb (+ get-dotenv DynamoDB plugin)

This file is a compact, assistant-focused guide for using this repo’s two public entrypoints correctly and effectively:

- Base library: `@karmaniverous/entity-client-dynamodb`
- DynamoDB get-dotenv plugin: `@karmaniverous/entity-client-dynamodb/get-dotenv`

## TL;DR (choose the right import path)

- App/library code (DynamoDB client + QueryBuilder + table definition helpers): import from `@karmaniverous/entity-client-dynamodb`.
- get-dotenv host/plugin code (CLI plugin + versioned table lifecycle + migration + local orchestration): import from `@karmaniverous/entity-client-dynamodb/get-dotenv`.
- Do not “reach into” `src/**` from consumers; rely on `package.json` `exports`.

## Public surfaces (minimize export surface area)

- Root entrypoint (`src/index.ts`) is the runtime client library surface (EntityClient + QueryBuilder + Tables) and a few type-only re-exports from `@karmaniverous/entity-manager`.
- `/get-dotenv` entrypoint (`src/get-dotenv/index.ts`) is the plugin surface (CLI plugin, services, and authoring helpers); it should not leak the base client API unless explicitly intended.

Packaging expectation (Option B, real subpath entrypoint):

- Root:
  - JS: `dist/mjs/index.js`, `dist/cjs/index.js`
  - Types: `dist/index.d.ts`
- Subpath:
  - JS: `dist/mjs/get-dotenv/index.js`, `dist/cjs/get-dotenv/index.js`
  - Types: `dist/get-dotenv/index.d.ts`

## Type inference mental model (base library)

- Token in → narrowed type out: pass a literal entity token (e.g. `'user' as const`) to narrow record/item types.
- Storage vs domain:
  - Storage records include keys; reads from DynamoDB return storage records.
  - Convert to domain shapes via `entityManager.removeKeys(entityToken, recordOrRecords)`.
- Projections use a type-only “K channel”:
  - Projection tuples passed as `as const` narrow the result types; resetting projections widens back to the default.
- Values-first config literal (“CF”) enables index token inference:
  - If your `EntityClient` carries a config literal type (CF), `createQueryBuilder` can infer index tokens and per-index page keys; otherwise index tokens fall back to `string`.

## Base library cookbook

### EntityClient (connect + CRUD + batches)

```ts
import {
  EntityClient,
  generateTableDefinition,
} from '@karmaniverous/entity-client-dynamodb';

const client = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'local',
  // Optional for local: endpoint + fake creds, etc.
});

// Create table from EntityManager config
await client.createTable({
  BillingMode: 'PAY_PER_REQUEST',
  ...generateTableDefinition(entityManager),
});

// Put / Get (token-aware get)
await client.putItem({ hashKey2: 'h', rangeKey: 'r', a: 1 });
const out = await client.getItem('user', { hashKey2: 'h', rangeKey: 'r' });
const domain = out.Item && client.entityManager.removeKeys('user', out.Item);

// Projection tuple (narrowed Item shape)
const outProj = await client.getItem('user', { hashKey2: 'h', rangeKey: 'r' }, [
  'a',
] as const);
```

Notes:

- `getItem` / `getItems` accept projection tuples; if you pass a plain `string[]` (non-const), types widen.
- Batch helpers (`putItems`, `deleteItems`) retry `UnprocessedItems` via `@karmaniverous/batch-process`.

### QueryBuilder (cross-shard, multi-index query composition)

```ts
import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';

const qb = createQueryBuilder({
  entityClient: client,
  entityToken: 'user' as const,
  hashKeyToken: 'hashKey2' as const,
});

qb.addRangeKeyCondition('created', {
  property: 'created',
  operator: 'between',
  value: { from: 1700000000000, to: 1900000000000 },
});

qb.addFilterCondition('created', {
  operator: 'attribute_exists',
  property: 'updated',
});

// Optional: projections (narrow K channel)
const withProj = qb.setProjection('created', ['created'] as const);

// Run via EntityManager (provider-agnostic orchestration)
const shardQueryMap = withProj.build();
const { items, pageKeyMap } = await client.entityManager.query({
  entityToken: 'user',
  item: {},
  shardQueryMap,
  pageSize: 25,
});
```

Projection invariant (adapter behavior):

- When any projection is present, the DynamoDB adapter auto-includes the entity uniqueProperty and explicit sort keys at runtime to preserve dedupe/sort invariants.

### Tables (generate a DynamoDB table definition)

```ts
import { generateTableDefinition } from '@karmaniverous/entity-client-dynamodb';

const def = generateTableDefinition(entityManager);
await client.createTable({ BillingMode: 'PAY_PER_REQUEST', ...def });
```

Transcode attribute type mapping:

- Use `defaultTranscodeAttributeTypeMap` / `TranscodeAttributeTypeMap` when non-string transcodes need a DynamoDB ScalarAttributeType mapping.

## DynamoDB get-dotenv plugin cookbook (`/get-dotenv`)

### Purpose

- Provide a host-aware get-dotenv CLI plugin for:
  - versioned table definition YAML (comment-preserving generate/refresh)
  - drift validation
  - create/delete/purge flows
  - stepwise data migration with per-step transforms
  - local DynamoDB orchestration (config-first; embedded fallback)

### Recommended mounting model (aws-pattern)

- The expected usage is as a child of the shipped get-dotenv `aws` plugin.
- Commands are invoked as `aws dynamodb ...`.
- Plugin config is keyed under `plugins["aws/dynamodb"]` (realized mount path).

```ts
import { createCli } from '@karmaniverous/get-dotenv';
import { awsPlugin } from '@karmaniverous/get-dotenv/plugins';
import { dynamodbPlugin } from '@karmaniverous/entity-client-dynamodb/get-dotenv';

await createCli({
  alias: 'mycli',
  compose: (p) => p.use(awsPlugin().use(dynamodbPlugin())),
})(process.argv.slice(2));
```

### Expansion and precedence rules (critical)

- Host interpolates plugin config strings once before plugin code runs.
- Resolver policy in this repo: expand runtime flags once; do not re-expand config-origin strings.
- Precedence: CLI flags (expanded) > plugin config (already interpolated) > defaults.

### Versioned layout (tables lifecycle)

Default layout under `tablesPath` (default: `tables`):

```text
tables/
  table.template.yml       (optional baseline)
  001/
    entityManager.ts|.js   (may fall back to earlier versions)
    table.yml|.yaml        (full AWS::DynamoDB::Table resource)
    transform.ts|.js       (optional per-step transforms)
```

Rules:

- Version ordering is numeric (not lexicographic).
- Digit-only directories are valid (`^\d+$`), but duplicate numeric values (e.g. `1/` and `001/`) are a hard error.
- `minTableVersionWidth` controls cosmetic padding when formatting new tokens (it does not restrict existing dir names).

### Managed table properties (non-generated keys)

Tooling can optionally manage (apply deterministically on generate/refresh; validate for drift on validate/create):

- `Properties.BillingMode`
- `Properties.ProvisionedThroughput`
- `Properties.TableName`

Invariants:

- If throughput is managed, BillingMode must be managed and must be `PROVISIONED`, and both RCU/WCU must be present.
- If BillingMode is managed as `PAY_PER_REQUEST`, ProvisionedThroughput must not exist in YAML.

### Key service entrypoints (pure logic)

Import from `@karmaniverous/entity-client-dynamodb/get-dotenv`:

- Layout/discovery: `resolveVersionDir`, `listVersionDirEntries`, `resolveEntityManagerFileWithFallback`, `resolveTableFile`, `enumerateStepVersions`
- YAML generation: `generateTableDefinitionAtVersion`, `composeNewTableYaml`, `refreshGeneratedSectionsInPlace`, `computeGeneratedSections`
- Drift validation: `validateTableDefinitionAtVersion`, `validateGeneratedSections`
- Lifecycle: `createTableAtVersion`, `deleteTable`, `purgeTable`
- Migration: `migrateData` (stepwise; transforms; progress; bounded memory)
- Local orchestration: `startLocal`, `stopLocal`, `statusLocal`, `deriveEndpoint`

### Migration chain semantics (must know)

- Migration is stepwise for versions `from < k <= to`, ascending numeric order.
- For each step:
  - Resolve prev EM and next EM with fallback (walk backward).
  - Load optional `transform` map; missing handlers use default chain.
- Default chain (per record):
  - `item = prev.removeKeys(entityToken, record)`
  - `nextRecord = next.addKeys(entityToken, item)`
- Transform handler return conventions:
  - `undefined` → drop record
  - single item/record → migrate one
  - array of items/records → fan-out
- Boundaries are strict: both `fromVersion` and `toVersion` must exist as version dirs or migration errors (never silently no-op).

Transform authoring helper:

```ts
import { defineTransformMap } from '@karmaniverous/entity-client-dynamodb/get-dotenv';
export default defineTransformMap<PrevCM, NextCM>({
  user: async (record, { prev, next }) => {
    const item = prev.removeKeys('user', record);
    return next.addKeys('user', item);
  },
});
```

### Local DynamoDB orchestration (config-first)

- If config `plugins["aws/dynamodb"].local.{start|stop|status}` is present, those commands run under a shell in the composed env.
- If not present, embedded fallback uses `@karmaniverous/dynamodb-local` when installed; otherwise the command errors with guidance.
- Start waits for readiness (library readiness preferred; else SDK probe).

## Common pitfalls (and how to avoid them)

- Subpath exports must be real: `/get-dotenv` should have its own JS and its own `.d.ts`, not aliases to root.
- Rollup externals must treat dependency subpaths as external (e.g. `@karmaniverous/get-dotenv/cliHost`), otherwise bundling can pull in transitive deps like `execa` and break builds.
- Avoid exporting Zod schema constants in the public docs surface unless you intend to document their entire `__type` tree; prefer exporting the config type only.
- For docs/lint in this repo:
  - `npm run docs` is a gate (TypeDoc warnings must be 0).
  - `eslint-plugin-tsdoc` is active; avoid brace-like constructs in TSDoc unless escaped.

## Quick repo map (where to look)

- Root public entrypoint: `src/index.ts`
- DynamoDB client: `src/EntityClient/**`
- QueryBuilder: `src/QueryBuilder/**`
- Table definition: `src/Tables/**`
- get-dotenv subpath entrypoint: `src/get-dotenv/index.ts`
- get-dotenv services: `src/get-dotenv/services/**`
- get-dotenv CLI plugin (Commander wiring): `src/get-dotenv/cli/plugin/**`
- get-dotenv option resolvers: `src/get-dotenv/cli/options/**`
- Versioned layout utilities: `src/get-dotenv/layout.ts`
