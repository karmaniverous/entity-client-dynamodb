# Entity Manager Demo

![Node Current](https://img.shields.io/node/v/@karmaniverous/entity-manager-demo) <!-- TYPEDOC_EXCLUDE --> [![docs](https://img.shields.io/badge/docs-website-blue)](https://docs.karmanivero.us/entity-manager-demo) [![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/entity-manager-demo/tree/main/CHANGELOG.md)<!-- /TYPEDOC_EXCLUDE --> [![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/entity-manager-demo/tree/main/LICENSE.md)

[**Entity Manager**](https://karmanivero.us/projects/entity-manager/) implements rational indexing & cross-shard querying at scale in your [NoSQL](https://en.wikipedia.org/wiki/NoSQL) database so you can focus on your application logic.

This repository presents a working demonstration of **Entity Manager** in action. See [the companion article](https://karmanivero.us/projects/entity-manager/demo/) for a detailed explanation!

---

## Getting started (2 minutes)

Prereqs

- Node 18+ and npm
- Docker Desktop (for DynamoDB Local)

Install and run tests:

```bash
npm i
npm test
```

The first test run will pull the DynamoDB Local Docker image and may take a couple of minutes. Subsequent runs are fast.

## Run locally

This project uses DynamoDB Local via Docker. The tests handle container lifecycle automatically:

- Start DynamoDB Local on port 8000
- Create the demo table with indexes derived from the Entity Manager config
- Exercise CRUD and search flows
- Tear down the container

Port can be configured by setting DYNAMODB_LOCAL_PORT (default 8000). See `.env` and `.env.local.template`.

## What’s in the box

- src/entity-manager
  - entityManager.ts — value-first config literal wired to createEntityManager
  - entityClient.ts — DynamoDB client (EntityClient) wired to the manager
  - Email.ts, User.ts — Zod schemas + inferred domain types
- src/handlers
  - email/\* — CRUD and search for Email
  - user/\* — CRUD and search for User, including multi-index name search
- src/test
  - generate\* helpers to synthesize demo data
  - integration tests running against DynamoDB Local
- diagrams — PlantUML overview diagrams

Everything is TypeScript-first with strong inference. Handlers stay small by delegating key generation, sharding, and cross-index querying to Entity Manager and the DynamoDB adapter.

## Quick taste

Create a user and then search by name:

```ts
import { createUser, searchUsers } from './src/handlers';

// Create a user record
const user = await createUser({
  userId: undefined, // will be generated
  beneficiaryId: 'BEN123',
  firstName: 'Ada',
  lastName: 'Lovelace',
});

// Find by name prefix (case/whitespace/diacritics insensitive)
const result = await searchUsers({ name: 'lov' });
console.log(result.items.map((u) => `${u.firstName} ${u.lastName}`));
```

Under the hood:

- Keys are generated consistently from the config (global hash/range keys plus generated tokens)
- Searches route to the right indexes and shard space based on your params
- Result sets are deduped, sorted on domain properties, and come with a `pageKeyMap` for the next call

## Developer experience (DX) tips

- Value-first config: the Entity Manager config is authored as a literal (`as const`) so TypeScript can infer tokens and index names.
- Schema-first types: Email and User are defined via Zod; types are inferred from the schemas.
- Token-aware reads: pass the entity token and get proper types without generics or casts.
- Projection-aware queries: the DynamoDB QueryBuilder supports per-index projections; adapters auto-include unique and sort keys to preserve dedupe/sort behavior.
- Logging: the internal libraries are chatty at debug level; we inject a proxy logger that suppresses `debug` while leaving `error` intact. Flip it on in `src/util/logger.ts` if you want to see the wire-level details.

## Scripts

- `npm run test` — run integration tests (DynamoDB Local via Docker)
- `npm run typecheck` — TypeScript typecheck
- `npm run lint` — ESLint (Prettier integrated)
- `npm run docs` — typedoc (docs build used in the API docs link above)

Built for you with ❤️ on Bali! Find more great tools & templates on [my GitHub Profile](https://github.com/karmaniverous).
