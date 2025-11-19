# Interop — Option B helper typing (Generic BaseQueryBuilder acceptance)

Purpose
- Remove variance-bridging casts at QueryBuilder call sites by relaxing helper parameter
  types to accept any BaseQueryBuilder instantiation while intersecting the mutable shape
  actually used by the helpers (indexParamsMap + logger).
- Typing-only change; no runtime behavior differences.

Background
- Downstream adapters extend BaseQueryBuilder with additional generics (CF for page-key
  narrowing and K for projected results). Helpers such as `addRangeKeyCondition` and
  `addFilterCondition` operate on a small subset of builder state but were typed narrowly,
  forcing call-site casts (`unknown as …`).
- Option B keeps a strong semantic tie to BaseQueryBuilder while remaining variance-friendly.

## Target signatures (TypeScript)

```ts
import type {
  BaseConfigMap,
  BaseEntityClient,
  BaseQueryBuilder,
  EntityToken,
} from '@karmaniverous/entity-manager';

// IndexParams is the adapter’s per-index state mutated by helpers.
// RangeKeyCondition / FilterCondition come from the adapter’s public types.

export function addRangeKeyCondition<
  CC extends BaseConfigMap,
  Client extends BaseEntityClient<CC>,
  ET extends EntityToken<CC>,
  ITS extends string,
  CF = unknown,
  K = unknown,
>(
  builder: BaseQueryBuilder<CC, Client, unknown, ET, ITS, CF, K> & {
    indexParamsMap: Record<ITS, IndexParams>;
    entityClient: { logger: Pick<Console, 'debug' | 'error'> };
  },
  indexToken: ITS,
  condition: RangeKeyCondition,
): void;

export function addFilterCondition<
  CC extends BaseConfigMap,
  Client extends BaseEntityClient<CC>,
  ET extends EntityToken<CC>,
  ITS extends string,
  CF = unknown,
  K = unknown,
>(
  builder: BaseQueryBuilder<CC, Client, unknown, ET, ITS, CF, K> & {
    indexParamsMap: Record<ITS, IndexParams>;
    entityClient: { logger: Pick<Console, 'debug' | 'error'> };
  },
  indexToken: ITS,
  condition: FilterCondition<CC>,
): void;
```

Notes
- The intersection expresses the precise mutable contract (`indexParamsMap` + `logger`)
  while preserving the BaseQueryBuilder semantic tie.
- ITS flows from the builder to `indexToken`, keeping helpful key narrowing at call sites.
- CF/K remain unconstrained and compatible with current/next adapters.

## Steps to implement (entity-client-dynamodb)

1) Update helper parameter types
   - Files (paths may differ by layout):
     - `src/QueryBuilder/helpers/addRangeKeyCondition.ts`
     - `src/QueryBuilder/helpers/addFilterCondition.ts`
   - Replace the existing `builder` parameter types with the generic `BaseQueryBuilder<…> & { indexParamsMap …; entityClient … }` intersections shown above.
   - Do not change function bodies; no runtime logic change required.

2) Remove variance casts at call sites
   - In `QueryBuilder` methods or anywhere that previously called:
     ```ts
     // Before
     addRangeKeyCondition(this as unknown as QueryBuilder<C>, indexToken, cond);
     addFilterCondition(this as unknown as QueryBuilder<C>, indexToken, cond);
     ```
     Replace with:
     ```ts
     addRangeKeyCondition(this, indexToken, cond);
     addFilterCondition(this, indexToken, cond);
     ```
   - After the helper signature updates, these calls should be assignable without casts.

3) Compile/typecheck (including docs build)
   - `pnpm run typecheck && pnpm run build && pnpm run docs`
   - Expect no new errors or warnings; signatures are typing-only relaxations.

4) Test
   - Unit/integration tests should remain green (no runtime changes).
   - Optional tsd coverage:
     - Validate that calling the helpers from `QueryBuilder<C, ET, ITS, CF, K>` compiles cleanly without casts.
     - Assert that indexToken remains ITS-narrowed from the builder.

5) Release plan (patch)
   - Prepare a patch release with a changelog entry similar to:
     - “Typing: accept generic BaseQueryBuilder in helper params (Option B). Removes cast requirements in adapters; no runtime behavior changes.”

## Migration impact

- No changes required for consumer code. Existing QueryBuilder usage continues to work.
- Adapters should remove now-unnecessary variance-bridging casts at helper call sites.
- No runtime behavior changes; unit/integration tests are authoritative.

## Rationale

- Keeps a strong semantic tie to BaseQueryBuilder (better DX than pure structural typing).
- Explicitly documents the only mutable state helpers rely on (`indexParamsMap` and logger).
- Eliminates brittle casts and improves readability without widening runtime scope.
