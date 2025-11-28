# Interop — Response: Preserve values‑first config literal for index‑aware typing

When: 2025‑11‑28

Repository: @karmaniverous/entity-manager

Status: implemented upstream (type‑only change; no runtime impact)

## Summary

- Problem statement (from your request): downstream builders need the literal union of index tokens (ITS) and per‑index page‑key narrowing. Those literals are lost once config is parsed to a `ParsedConfig` with `indexes: Record<string, …>`. Current workaround requires passing `cf` (values‑first literal) to the builder.
- Upstream solution (implemented): carry the values‑first literal type “CF” as a phantom generic on `EntityManager` and return `EntityManager<…, CC>` from a single‑argument factory `createEntityManager(config)`. No runtime field was introduced; CF is type‑only.
- Adapter leverage: make `EntityClient` generic on `CF` and accept `EntityManager<CC, CF>`; change `createQueryBuilder` to infer `ITS = IndexTokensOf<CF>` from the client and remove the explicit `cf` parameter.

## What changed upstream (entity‑manager)

Type‑only, no runtime behavior changes:

- EntityManager now carries CF as a phantom generic:
  - `class EntityManager<CC extends BaseConfigMap, CF = unknown> { … }`
  - No runtime `configLiteral` property was added (per your preference).
- Factory captures CF from the single config literal:
  - `createEntityManager<const CC extends ConfigInput, EM extends EntityMap = EntitiesFromSchema<CC>>(config: CC, …): EntityManager<CapturedConfigMapFrom<CC, EM>, CC>`
  - Callers still pass exactly one config object (values‑first literal; prefer `as const`).
- All tests, build, and docs pass unchanged (runtime semantics stable).

## How to leverage this in entity-client-dynamodb

1) Make EntityClient carry CF and accept EntityManager<CC, CF>

- Update the client to be generic on CF and require an EM carrying the same CF:
  - Before:
    - `class EntityClient<CC extends BaseConfigMap> extends BaseEntityClient<CC> { … }`
    - `constructor(options: { entityManager: EntityManager<CC>; … })`
  - After:
    - `class EntityClient<CC extends BaseConfigMap, CF = unknown> extends BaseEntityClient<CC> { … }`
    - `constructor(options: { entityManager: EntityManager<CC, CF>; … })`

This preserves CF at the adapter boundary without changing runtime shape.

2) Derive ITS from CF in builder creation; remove explicit cf param

- Change `createQueryBuilder` to infer ITS from the client’s CF:
  - Before (requiring `cf`):
    ```ts
    export function createQueryBuilder<C extends BaseConfigMap, ET extends EntityToken<C>, CF>(options: {
      entityClient: EntityClient<C>;
      entityToken: ET;
      hashKeyToken: C['HashKey'] | C['ShardedKeys'];
      cf: CF;                 // required today
      pageKeyMap?: string;
    }): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>;
    ```
  - After (no `cf` required; CF inferred from client):
    ```ts
    export function createQueryBuilder<C extends BaseConfigMap, ET extends EntityToken<C>, CF>(options: {
      entityClient: EntityClient<C, CF>;               // carries CF
      entityToken: ET;
      hashKeyToken: C['HashKey'] | C['ShardedKeys'];
      pageKeyMap?: string;
    }): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>;
    ```

3) Keep QueryBuilder generics as‑is; K and CF continue threading

- `QueryBuilder<C, ET, ITS, CF, K>` remains the public surface.
- With CF present, ITS narrows to `keyof CF['indexes']` and `PageKeyByIndex<C, ET, IT, CF>` narrows per index automatically.

4) Helper functions remain compatible

- Existing helpers that accept a structural `BaseQueryBuilder` shape (e.g., `addRangeKeyCondition`, `addFilterCondition`) remain variance‑friendly and do not need runtime changes. CF continues to flow through the type parameters.

## Minimal code example (after changes)

```ts
import { createEntityManager } from '@karmaniverous/entity-manager';
import { EntityClient, createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';

// Values‑first config literal — preserve keys with `as const`
const config = {
  hashKey: 'hashKey2',
  rangeKey: 'rangeKey',
  indexes: {
    created: { hashKey: 'hashKey2', rangeKey: 'created' },
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
  },
  // …generatedProperties, propertyTranscodes, entities, etc.
} as const;

// CF is captured from the single literal argument
const em = createEntityManager(config);

// EntityClient carries CF via EntityManager<…, CF>
const client = new EntityClient({ entityManager: em, tableName: 'users' /* … */ });

// Builder infers ITS = 'created' | 'firstName' from client CF — no cf argument needed
const qb = createQueryBuilder({
  entityClient: client,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});

// Per‑index page keys are narrowed automatically (e.g., for 'firstName')
// ShardQueryFunction<C, 'user', 'firstName', CF, K> narrows pageKey to { hashKey2?; rangeKey?; firstNameRK? }
```

## Migration notes

- Remove the explicit `cf` argument at builder creation sites; ensure the `EntityClient` is typed on CF and constructed with an `EntityManager` returned by `createEntityManager(configLiteral as const)`.
- If a consumer constructed `EntityManager` directly via `new EntityManager(config as Config<…>)`, CF defaults to `unknown`. Recommend switching to `createEntityManager(literal)` for automatic CF capture.
- No runtime changes are required in your adapter — this is a type‑only enhancement.

## Acceptance criteria (adapter)

- With a values‑first config literal used to instantiate the EntityManager:
  - `createQueryBuilder({ entityClient, entityToken, hashKeyToken })` infers `ITS = keyof config.indexes` without requiring a `cf` argument.
  - `PageKeyByIndex<C, ET, IT, CF>` narrows per index to only its component tokens (hashKey, rangeKey, and that index’s specific generated/ungenerated keys).
- With a non‑literal/dynamic config:
  - Types remain valid; ITS falls back to `string` until consumers adopt a values‑first literal (as today).

## API checklist (entity-client-dynamodb)

1) Types
   - [ ] `class EntityClient<CC extends BaseConfigMap, CF = unknown>`
   - [ ] `constructor(options: { entityManager: EntityManager<CC, CF>; … })`
   - [ ] `createQueryBuilder<C, ET, CF>({ entityClient: EntityClient<C, CF>, entityToken, hashKeyToken, pageKeyMap? }): QueryBuilder<C, ET, IndexTokensOf<CF>, CF>`
   - [ ] Remove/replace prior overload requiring `cf`.
2) Examples/Docs
   - [ ] Update guides and README snippets: create builder without `cf`; highlight `createEntityManager(config as const)` pattern.
3) Tests
   - [ ] Compile‑only tests (tsd) asserting ITS and page‑key narrowing derive from client CF.
   - [ ] No runtime tests need changes; behavior is unchanged.

## Why no runtime `configLiteral` property?

- The type system already threads CF via generics; adding a runtime field does not improve inference and risks confusion about which config to use at runtime. The canonical runtime config remains `ParsedConfig` (`em.config`).

## Release coordination

- entity‑manager: shipped (type‑only change; green scripts).
- entity‑client‑dynamodb: implement the changes above; publish a minor release that drops the `cf` parameter at call sites in favor of CF derived from `EntityClient`.

Questions or blockers: open an interop note referencing this response and we’ll iterate quickly.
