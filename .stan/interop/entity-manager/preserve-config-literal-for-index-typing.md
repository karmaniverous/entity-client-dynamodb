# Interop — Preserve values‑first config literal for index‑aware typing

When: 2025‑11‑25

Scope

- Downstream adapters (e.g., the DynamoDB QueryBuilder in entity‑client‑dynamodb) need the literal union of index tokens to provide:
  - Narrowed ITS (index token subset) in builders,
  - Per‑index page‑key narrowing (PageKeyByIndex<…, CF>),
  - Token‑aware ergonomics without casts.
- Today this is enabled via an optional `cf` parameter to `createQueryBuilder`, where callers pass the values‑first config literal (as const). That literal preserves `keyof cf.indexes` as a union.
- Developers asked if we can instead infer CF from `entityClient.entityManager.config` and drop `cf`. Short answer: not with the current types — `config` is the parsed/normalized runtime shape (ParsedConfig) whose `indexes` are typed as `Record<string, …>`, so literal keys are not available to the type system.

Background (why `cf` exists)

- TypeScript can only derive the index‑token union from a values‑first config literal type at the call site. Once a config passes through Zod (or any normalization step) and becomes `ParsedConfig`, `indexes` is `Record<string, …>`, and `keyof ParsedConfig['indexes']` collapses to `string`.
- Therefore `createQueryBuilder` offers an overload with an explicit `cf` that preserves literal keys and narrows types:
  ```ts
  const qb = createQueryBuilder({
    entityClient,
    entityToken: 'user' as const,
    hashKeyToken: 'hashKey2' as const,
    cf: myConfigLiteral as const, // derives ITS = keyof cf.indexes; narrows page keys by index
  });
  ```
- Passing `cf: entityClient.entityManager.config` compiles, but brings no type benefit — CF is inferred as ParsedConfig, so ITS remains `string`.

Proposal — carry the values‑first literal in EntityManager types

Introduce a second, phantom generic CF on `EntityManager` (and `EntityClient`) to preserve the values‑first config literal type alongside the normalized map:

1. EntityManager generic and property

```ts
// Before
class EntityManager<C extends BaseConfigMap> {
  config: ParsedConfig;
  // ...
}

// After (back‑compat preserved via default)
class EntityManager<C extends BaseConfigMap, CF = unknown> {
  config: ParsedConfig; // normalized runtime shape (unchanged)
  readonly configLiteral?: CF; // typed reference to the values‑first literal (type channel)
  // ...
}
```

Update the factory so it captures CF directly from the values‑first input and assigns `configLiteral` at runtime:

```ts
// Before
function createEntityManager<
  const CC extends ConfigInput,
  EM extends EntityMap = EntitiesFromSchema<CC>,
>(
  config: CC,
  logger?: Pick<Console, 'debug' | 'error'>,
): EntityManager<CapturedConfigMapFrom<CC, EM>>;

// After
function createEntityManager<
  const CC extends ConfigInput,
  EM extends EntityMap = EntitiesFromSchema<CC>,
>(
  config: CC,
  logger?: Pick<Console, 'debug' | 'error'>,
): EntityManager<CapturedConfigMapFrom<CC, EM>, CC>;
// In constructor/factory body: em.configLiteral = config;
```

2. EntityClient generic

```ts
// Before
class EntityClient<C extends BaseConfigMap> extends BaseEntityClient<C> {
  /* ... */
}

// After
class EntityClient<
  C extends BaseConfigMap,
  CF = unknown,
> extends BaseEntityClient<C> {
  /* ... */
}
// constructor(options: { entityManager: EntityManager<C, CF>; /* ... */ })
```

3. QueryBuilder / factory — prefer CF from client (remove need for explicit cf at call sites)

Add an overload that infers CF via `EntityClient<C, CF>` and derives `ITS = IndexTokensOf<CF>`:

```ts
// New preferred overload (no explicit cf needed)
export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF,
>(options: {
  entityClient: EntityClient<C, CF>; // carries CF
  entityToken: ET;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  pageKeyMap?: string;
}): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>;

// Keep current overload for mixed/legacy clients (optional cf)
export function createQueryBuilder<
  C extends BaseConfigMap,
  ET extends EntityToken<C>,
  CF,
>(options: {
  entityClient: EntityClient<C>; // CF may be unknown here
  entityToken: ET;
  hashKeyToken: C['HashKey'] | C['ShardedKeys'];
  cf: CF; // explicit literal
  pageKeyMap?: string;
}): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>;
```

Internally, QueryBuilder already threads K/CF through to `PageKeyByIndex<C, ET, IT, CF>`; with CF available from the client, per‑index page keys narrow automatically.

Why this works

- The values‑first config literal type (CF) is captured where it’s available (at construction) and preserved in generics. TypeScript can then derive `keyof CF['indexes']` as a literal union and narrow ITS/page keys accordingly.
- The exposed `configLiteral?: CF` is primarily a type channel; it need not (and should not) change runtime behavior. The public `config` remains the validated `ParsedConfig` for runtime use.

Back‑compat and migration

- All new generics are defaulted to `unknown`, so existing code compiles unchanged (ITS remains `string` in the absence of CF).
- Projects that already author a values‑first literal and call `createEntityManager(literal)` gain type benefits automatically — they no longer need to pass `cf` to the builder.
- Keep the explicit `cf` overload as a bridge for mixed stacks or older clients; it can be deprecated later.

Runtime impact

- None. This is a type‑only improvement:
  - `configLiteral` can reference the same object passed to the factory (no deep clone required),
  - The `config` runtime contract and parsing/validation remain unchanged,
  - No additional runtime logic is needed in adapters; they only consume CF at the type level.

Why not reuse `entityManager.config` directly?

- `entityManager.config` is a runtime `ParsedConfig` shaped by Zod; its `indexes` key is `Record<string, …>`. There’s no way for TS to recover literal index tokens from that shape.
- Binding generics like `CF extends EntityClient<C>['entityManager']['config']` merely yields `ParsedConfig`, which collapses ITS to `string` and defeats type narrowing. The literal must be preserved at the type level and carried from construction.

Examples

Values‑first model (recommended):

```ts
import { createEntityManager } from '@karmaniverous/entity-manager';
import { EntityClient } from '@karmaniverous/entity-client-dynamodb';
import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';

// Values‑first literal (keep as const to preserve literal keys)
const config = {
  hashKey: 'hashKey2',
  rangeKey: 'rangeKey',
  indexes: {
    created: { hashKey: 'hashKey2', rangeKey: 'created' },
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
  },
  // ... generatedProperties, propertyTranscodes, entities, etc.
} as const;

const em = createEntityManager(config); // EntityManager<…, typeof config>
const client = new EntityClient({ entityManager: em /* ... */ }); // EntityClient<…, typeof config>

// No explicit cf needed — CF is inferred from client
const qb = createQueryBuilder({
  entityClient: client,
  entityToken: 'user' as const,
  hashKeyToken: 'hashKey2' as const,
});
// ITS = 'created' | 'firstName'
// PageKeyByIndex<C, 'user', 'created', CF> narrows property tokens to exactly CF.indexes['created'].rangeKey
```

Mixed model (older clients or non‑literal managers):

```ts
// Keep existing overload for compatibility
const qb2 = createQueryBuilder({
  entityClient: legacyClient, // CF = unknown (no narrowing)
  entityToken: 'user' as const,
  hashKeyToken: 'hashKey2' as const,
  cf: config, // explicit literal preserves narrowing
});
```

Risks and considerations

- API surface bumps (type‑only):
  - `EntityManager<C, CF = unknown>`
  - `EntityClient<C, CF = unknown>`
  - `createEntityManager` returns `EntityManager<…, CC>`
  - `createQueryBuilder` gains a CF‑aware overload
- Documentation:
  - Emphasize “values‑first literal (as const)” patterns so callers understand when narrowing will apply automatically.
  - Clarify that `configLiteral` is a typed channel; runtime consumers should continue using `config`.
- Tooling/TS implications:
  - No changes to Zod schemas or parsing; only generic parameters and signatures expand.
  - Default CF to `unknown` so adoption can be incremental.

Summary

- The current `cf` parameter exists because the parsed runtime config does not preserve literal index tokens.
- By threading a phantom generic CF through `EntityManager` → `EntityClient` and exposing a typed `configLiteral?: CF`, downstream adapters can infer the literal index‑token union automatically and remove the need for explicit `cf` at call sites.
- This is a type‑only, back‑compatible enhancement; runtime behavior remains unchanged.
