# Entity Manager Demo — Requirements (authoritative)

Purpose
- Demonstrate a first-class, schema-first + value-first, inference-only developer experience using:
  - @karmaniverous/entity-manager (token-aware/index-aware orchestration)
  - @karmaniverous/entity-client-dynamodb (typed DynamoDB adapter)
  - @karmaniverous/entity-tools (utility/types)

Guiding principles
- Schema-first:
  - Zod schemas define domain shapes for each entity (no generated/global keys).
  - Types are inferred from schemas (z.infer); no hand-written interfaces with index signatures.
- Value-first:
  - A single config literal (as const) captures entity tokens, generated-property tokens, and index tokens.
  - Use createEntityManager(config, logger?) to derive types from values and schemas; no generics at call sites.
- Token-aware & index-aware:
  - addKeys/getPrimaryKey/removeKeys narrow by entity token (no casts).
  - QueryBuilder is CF-aware (config literal): narrows index-token unions and page-key types; shardQueryMap is executed by EntityManager.query.
- Inference-only DX:
  - No generics or type casts at handler call sites.
  - Literal values (entityToken, indexToken) and const tuples drive all type narrowing.

Scope (demo targets)
- Entities: User, Email (domain-only fields).
- Operations:
  - CRUD for User/Email.
  - Read flows with optional “keepKeys” ergonomics (records with keys vs items without keys).
  - Search flows across explicit index tokens with typed page keys and optional projections.
  - Table lifecycle via generateTableDefinition and EntityClient.

## Technical requirements

### 1) Entities and schemas
- Provide Zod schemas for domain shapes:
  - Email: { created: number; email: string; userId: string }
  - User: { beneficiaryId: string; created: number; firstName: string; firstNameCanonical: string; lastName: string; lastNameCanonical: string; phone?: string; updated: number; userId: string }
- Export inferred types from schemas (z.infer<typeof emailSchema>, z.infer<typeof userSchema>).
- Do not extend any ad-hoc “Entity” interface with index signatures; public domain types are strictly structural and schema-driven.

### 2) Value-first config literal (as const)
- A single config literal (as const) defines:
  - hashKey: 'hashKey'
  - rangeKey: 'rangeKey'
  - entitiesSchema: { email: emailSchema, user: userSchema }
  - generatedProperties:
    - sharded tokens: 'userHashKey', 'beneficiaryHashKey'
    - unsharded tokens: 'firstNameRangeKey', 'lastNameRangeKey'
  - indexes (names exactly match handler usage):
    - Global hash: created | firstName | lastName | phone | updated
    - Beneficiary-scope: userBeneficiaryCreated | userBeneficiaryFirstName | userBeneficiaryLastName | userBeneficiaryPhone | userBeneficiaryUpdated
    - User-scope (Email): userCreated
  - propertyTranscodes and transcodes (defaultTranscodes).
- Use createEntityManager(config, logger?) to initialize the manager; no runtime errors on entitiesSchema; parsed config is validated as before.

### 3) DynamoDB client (adapter)
- Use EntityClient with the manager + logger + endpoint/region credentials.
- generateTableDefinition(manager) returns AttributeDefinitions/GSIs/KeySchema; EntityClient.createTable merges billing/throughput.

### 4) Token-aware reads (no casts)
- Token-aware getItem/getItems:
  - With an entity token and removeKeys literal:
    - removeKeys: true → EntityItemByToken<…, ET> (domain objects; keys stripped)
    - removeKeys: false → EntityRecordByToken<…, ET> (records with keys)
  - Tuple projections:
    - getItem(s)(token, …, attributes: const tuple, options?) → items narrowed to Pick over the correct base (item/record), via Projected<T, A>.
- Handlers exposing read helpers provide overloads:
  - readUser(userId, keepKeys: true): Promise<EntityRecordByToken<…, 'user'>[]>
  - readUser(userId, keepKeys?: false): Promise<User[]>
  - Same for readEmail.

### 5) Writes & deletes (token-aware)
- addKeys('user'|'email', item) with inferred domain types (no index signatures).
- getPrimaryKey('user'|'email', item|items) before deletes/reads.
- updateUser: shallow updates via updateRecord; TypeScript-enforced “MakeUpdatable” semantics for optional deletions (null) and ignoring undefined.

### 6) Search flows (index-aware and page-key aware)
- Use createQueryBuilder({ entityClient, entityToken: 'user'|'email', hashKeyToken, cf }) with cf.indexes (as const):
  - Use literal index tokens from the CF union (ITS) in addRangeKeyCondition/addFilterCondition (no dynamic strings).
  - Compose per-index conditions (e.g., created between, begins_with on name range keys).
  - Optional: setProjection/index; setScanIndexForward.
  - Build the shardQueryMap via qb.build().
- Query orchestration:
  - Call EntityManager.query({ entityToken, item, shardQueryMap, pageSize/limit/sortOrder, timestampFrom/to, pageKeyMap? }).
  - Returned { items, count, pageKeyMap } — typed items (token-aware), pageKeyMap as dehydrated map.
  - For paging, pass pageKeyMap back to subsequent calls.

### 7) Sorting policy (domain-first)
- Sorting presented to callers must be on domain properties (e.g., created/updated/lastNameCanonical/firstNameCanonical).
- Avoid sorting on generated range-key tokens for domain-item arrays.
- Sorting on records (with keys) is allowed; remove keys afterwards if needed for API response.

### 8) Documentation & examples
- README demonstrates:
  - Zod schemas → value-first config literal (as const) with entitiesSchema.
  - createEntityManager(config) → EntityClient → one token-aware read with removeKeys literal.
  - CF-aware QueryBuilder with one index condition (literal ITS); build; call EntityManager.query; show paging via pageKeyMap.
  - Optional: tuple projection narrowing in one example; adapter policy auto-includes uniqueProperty + explicit sort keys.
  - No generics or type casts at call sites.

### 9) Tests
- Runtime tests (Vitest; DynamoDB Local):
  - Table lifecycle (create/delete).
  - CRUD for User/Email; update semantics; delete with getPrimaryKey.
  - Search flows (at least: created, name, beneficiary, phone, user emails).
  - Basic paging: re-use pageKeyMap for next page.
- Type-level tests (optional, tsd):
  - removeKeys literal narrowing: true → items (domain), false → records (keys).
  - Projection narrowing (const tuples) pick over correct base.
  - CF index tokens enforced; invalid tokens flagged at compile time.

### 10) Tooling & linting
- Node 18+; TypeScript 5+.
- eslint + prettier configurations remain in place.
- Vitest configured for single worker to avoid port collision with Docker.
- Scripts: test, typecheck (tsc plus tsd when enabled), lint, docs.

### 11) Non-requirements
- Do not add Entity index signatures back into domain types.
- Do not call QueryBuilder.query directly; manager.query is the source of truth for orchestration.
- Do not sort on generated range key tokens for domain items.
- Avoid type casts at handler call sites (token/value-first narrowing should suffice).

## Acceptance criteria
- Code compiles without casts at call sites (handlers/controllers).
- CRUD and search tests pass against DynamoDB Local.
- Token-aware reads return appropriately typed arrays based on removeKeys literals.
- CF-aware QueryBuilder composes index conditions on literal tokens; page keys type-check per index.
- README shows a minimal end-to-end example with schemas, config literal, token-aware read, and CF-aware query orchestration.
