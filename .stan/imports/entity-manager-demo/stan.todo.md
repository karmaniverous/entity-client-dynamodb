# Development plan

## Next up

1. Schemas & types (schema-first)
   - Add src/entity-manager/schemas.ts with Zod schemas for Email and User (domain-only).
   - Add src/entity-manager/types.ts exporting inferred types (z.infer).
   - Remove any extends Entity usage from public domain types (no index signatures).

2. Value-first manager (config literal)
   - Keep/confirm a single config literal (as const) with:
     - hashKey/rangeKey
     - entitiesSchema: { email, user }
     - generatedProperties (sharded/unsharded tokens)
     - indexes (literal union matches handler usage)
     - propertyTranscodes and transcodes (defaultTranscodes)
   - Use createEntityManager(config, logger); ensure no runtime errors with entitiesSchema.

3. Token-aware reads (handlers)
   - Refactor readUser/readEmail to use getItems('user'|'email', keys, { removeKeys: boolean literal }) and add overloads:
     - keepKeys true → records with keys; keepKeys false/omitted → items (domain).
   - Ensure usages in delete/update/news handlers align with keepKeys selection (records when composing keys; items for presentation).

4. Writes & updates (no casts)
   - create/update handlers call addKeys/getPrimaryKey/removeKeys with inferred types (no casts).
   - Update updateUser to keep domain-only sorting; no generated token usage in outward shapes.

5. Search flows (CF-aware)
   - Replace dynamic findIndexToken usage with literal index tokens from a CF literal (as const).
   - Use createQueryBuilder({ entityClient, entityToken, hashKeyToken, cf }); add per-index conditions; build(); call entityManager.query.
   - Sort results on domain properties; remove keys if necessary for response boundaries.
   - (Optional) Demonstrate tuple projection narrowing via setProjection or projected getItems.

6. Tests
   - Keep/expand integration tests: table lifecycle; CRUD; delete; search (created, name, beneficiary, phone, user emails); simple paging with pageKeyMap.
   - (Optional) Add tsd tests to pin: removeKeys narrowing; projection narrowing; CF index-token enforcement.

7. README overhaul
   - Add minimal end-to-end example:
     - Zod schemas → config literal (as const) → createEntityManager
     - EntityClient + token-aware read (removeKeys) + CF-aware QueryBuilder → manager.query
     - Optional: projection tuple example and short note on auto-included uniqueProperty/sort keys.

## Completed (recent)

**CRITICAL: This list is append-only; do not edit items! Place most recent entries at the BOTTOM of the list. When pruning, remove older entries from the top.**

- Interop: propose removeKeys-literal overloads in entity-client-dynamodb
  - Added .stan/interop/entity-client-dynamodb/remove-keys-literal-overloads.md
    describing additive overloads for getItem/getItems that narrow return types
    when `removeKeys` is a literal true/false in token-aware calls.
  - Included signatures for attribute and non-attribute variants, fallback to
    union for non-literal flags, and compatibility guidance.
  - Provided a tsd test plan to validate inference and optional runtime checks
    to confirm post-fetch key stripping under removeKeys=true.
  - Goal: enable keepKeys-style ergonomics downstream without local wrappers or
    assertions, while preserving backwards compatibility.
- Interop: propose token-aware types/overloads upstream in entity-manager
  - Added interop note at .stan/interop/entity-manager/token-aware-types-and-overloads.md
    specifying helper types (EntityItemByToken/EntityRecordByToken), overloads
    for removeKeys/addKeys/getPrimaryKey, scope (entity-manager only), and
    compatibility.
  - Included a concrete tsd-based test plan to validate inference (narrowed
    return types by token, fallback to union for dynamic tokens) and optional
    query typing extension.
  - This enables removing consumer-side casts like `as User[]` in this repo
    without changing runtime behavior.
- Tests: fix handlers CRUD assertions
  - Use updated[0] for deep include on array result from updateUser.
  - Expect empty array from readUser after delete (not undefined).
- Fix ESLint/TypeScript/Typedoc failures
  - Added devDependency eslint-plugin-prettier to satisfy flat-config import in
    eslint.config.ts and unblock lint/typedoc/knip.
  - Simplified "typecheck" script to "tsc -p tsconfig.json --noEmit"; removed
    stale tsd integration and config to avoid missing script/tool errors.

- Convert tests from Mocha/Chai to Vitest
  - Replaced before/after hooks with beforeAll/afterAll.
  - Removed explicit Chai imports; rely on Vitest’s globals and Chai-compatible
    assertions.
  - Removed unused Mocha-era devDependencies (chai, eslint-plugin-mocha,
    jsdom-global, source-map-support).

- Stabilize lint/typecheck for eslint.config.ts
  - Added ambient module declaration types/eslint-plugin-prettier.d.ts so
    TypeScript can typecheck the flat config without extra tsconfigs.
  - Included the new types/\*_/_.d.ts path in tsconfig.json "include".

- Eliminate Docker port conflict across suites
  - Configured Vitest single-worker execution (threads.singleThread = true) to
    prevent concurrent container startups on port 8000.

- Interop (entity-manager): accept or strip `entitiesSchema` in factory
  - Added .stan/interop/entity-manager/entitiesSchema-accept-or-strip.md
    requesting either Zod acceptance of the `entitiesSchema` key or a
    factory-level strip before invoking the constructor. Keeps README
    schema-first flow working and avoids the current ZodError while preserving
    existing runtime validation and behavior.

- Schema-first types and typed queries (partial)
  - Introduced Zod schemas and schema-inferred domain types:
    • src/entity-manager/schemas.ts
    • src/entity-manager/types.ts
  - Narrowed config capture with `satisfies ConfigInput` and const tuples/objects
    to preserve literal tokens for generated properties and indexes.
  - Replaced dynamic `findIndexToken` in user search with a typed route map; CF
    literal drives index-token union; adjusted sorting to domain properties.
  - Fixed imports to new types and satisfied QueryBuilder options with a typed
    cast at the call sites (`item: ... as never`).

- Interop (entity-manager): thread ET through QueryBuilder options
  - Proposed a types-only change to make `QueryBuilderQueryOptions` carry `ET`
    and update `BaseQueryBuilder.query` to accept the ET-aware options. This
    eliminates the need to cast `options.item` to `never` in downstream repos
    while preserving runtime behavior and backward compatibility.

- Consume upstream ET-aware QueryBuilder; preserve literal tokens locally
  - Bumped deps to entity-manager ^7.1.2 and entity-client-dynamodb ^0.4.2.
  - Preserved literal keys for generatedProperties (sharded/unsharded objects)
    to prevent widening of special keys to `string` and remove index-signature
    conflicts in token-aware helpers.
  - Removed temporary `item` casts in email/user search handlers; options.item
    is now typed by ET.

- Typecheck: preserve global key tokens to restore token-aware helper typings
  - Marked `hashKey` and `rangeKey` as string literals (`as const`) in
    src/entity-manager/entityManager.ts to prevent widening to `string` in the
    captured config. This fixes TS2769/TS2345 on addKeys/getPrimaryKey/putItems.

- Cleanup: remove unused types
  - Deleted the unused `MyConfigMap` interface and its imports in
    src/entity-manager/entityManager.ts (config is values-/schemas-first now).
  - Removed unused type aliases `EmailSchema` and `UserSchema` in schemas.ts.

- Handlers: token-aware reads with literal removeKeys (no casts)
  - Added overloads to readEmail/readUser and branched on keepKeys to pass
    literal removeKeys flags to token-aware getItems. Removed casts and return
    items directly (records when keepKeys=true; domain items otherwise).

- Handlers: fix overload typing and ensure domain reads are keyless
  - Derived the adapter config type (CC) from the EntityClient instance to type
    EntityRecordByToken return for keepKeys=true.
  - For domain reads, used const-tuple projections in token-aware getItems to
    fetch only domain fields, guaranteeing no keys are present at runtime.