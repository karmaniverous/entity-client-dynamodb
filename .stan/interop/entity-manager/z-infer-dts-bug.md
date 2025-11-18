# Interop — d.ts parse error from zod “infer” import (z.infer fix)

Status
- Blocking for typed builds and docs in entity-client-dynamodb when consuming the latest entity-manager.

Summary
- entity-manager’s published dist/index.d.ts imports `infer` from `zod` and uses it in a mapped type:
  - `import { z, ZodType, infer } from 'zod';`
  - `type EntitiesFromSchema<...> = { [K in keyof S & string]: infer<S[K]>; } ...`
- Multiple toolchains (tsc, typedoc, rollup-plugin-typescript) reject this syntax, reporting TS1003/TS1005/TS1109/TS1128 around those lines.
- Proposed fix: remove the named import `infer` and use `z.infer<...>` instead at type sites. Republish a patch release.

Environment (downstream)
- Downstream repo: @karmaniverous/entity-client-dynamodb @ main
- Node: 18+ (local dev)
- TypeScript: 5.9.3 (tsconfig ModuleResolution: Bundler)
- Bundler: rollup ^4.53.2 with @rollup/plugin-typescript
- typedoc: ^0.28.14
- OS: Windows 11 (local), expected to reproduce on others

Observed errors (excerpts)

From build.txt (rollup):
```text
node_modules/@karmaniverous/entity-manager/dist/index.d.ts (663:35): TS1003: Identifier expected.
663     [K in keyof S & string]: infer<S[K]>;
                                  ~
node_modules/@karmaniverous/entity-manager/dist/index.d.ts (663:37): TS1005: ',' expected.
663     [K in keyof S & string]: infer<S[K]>;
                                    ~
node_modules/@karmaniverous/entity-manager/dist/index.d.ts (663:40): TS1005: ';' expected.
663     [K in keyof S & string]: infer<S[K]>;
                                       ~
node_modules/@karmaniverous/entity-manager/dist/index.d.ts (663:41): TS1109: Expression expected.
663     [K in keyof S & string]: infer<S[K]>;
                                        ~
node_modules/@karmaniverous/entity-manager/dist/index.d.ts (664:1): TS1128: Declaration or statement expected.
664 } & EntityMap : EntityMap : EntityMap;
   ~
```

From docs.txt (typedoc):
```text
node_modules/@karmaniverous/entity-manager/dist/index.d.ts:663:35 - error TS1003: Identifier expected.
node_modules/@karmaniverous/entity-manager/dist/index.d.ts:663:37 - error TS1005: ',' expected.
node_modules/@karmaniverous/entity-manager/dist/index.d.ts:663:40 - error TS1005: ';' expected.
node_modules/@karmaniverous/entity-manager/dist/index.d.ts:663:41 - error TS1109: Expression expected.
node_modules/@karmaniverous/entity-manager/dist/index.d.ts:664:1 - error TS1128: Declaration or statement expected.
node_modules/@karmaniverous/entity-manager/dist/index.d.ts:664:3 - error TS1109: Expression expected.
```

From typecheck.txt (tsc):
```text
node_modules/@karmaniverous/entity-manager/dist/index.d.ts(663,35): error TS1003: Identifier expected.
... (same cluster as above)
```

Minimal repro (conceptual)
```ts
// In a published .d.ts:
import { z, ZodType, infer } from 'zod'; // <-- named import “infer”

type EntitiesFromSchema<CC> =
  CC extends { entitiesSchema?: infer S }
    ? S extends Record<string, ZodType>
      ? { [K in keyof S & string]: infer<S[K]> } & EntityMap // <-- infer<S[K]>
      : EntityMap
    : EntityMap;
```

Root cause hypothesis
- TypeScript treats `infer` as a contextual keyword in conditional types (to introduce type variables), not as a standalone generic helper.
- In declaration emit, `infer` should not appear as an imported symbol used like a generic helper. Many tools (including the TS compiler in different contexts) reject `infer<S[K]>` as an “Identifier expected” location because it’s not valid type syntax there.
- The intended usage with zod is `z.infer<typeof schema>` (a namespaced generic), not importing `infer` directly from zod’s types.

Proposed fix (upstream in entity-manager)
1) Adjust the zod import and mapped type:
   - Remove the named `infer` import from zod: `import { z, ZodType } from 'zod';`
   - Replace `infer<S[K]>` with `z.infer<S[K]>` at each type site.
2) Rebuild and republish a patch release of entity-manager with corrected .d.ts.

Illustrative patch (conceptual, not a full repo diff)
```diff
- import { z, ZodType, infer } from 'zod';
+ import { z, ZodType } from 'zod';

  type EntitiesFromSchema<CC> =
    CC extends { entitiesSchema?: infer S }
      ? S extends Record<string, ZodType>
-        ? { [K in keyof S & string]: infer<S[K]> } & EntityMap
+        ? { [K in keyof S & string]: z.infer<S[K]> } & EntityMap
        : EntityMap
      : EntityMap;
```

Acceptance criteria (downstream)
- With the patched entity-manager version:
  - `npm run typecheck` in entity-client-dynamodb completes with no TS errors.
  - `npm run docs` completes (Typedoc clean; no TS parser errors from node_modules).
  - `npm run build` completes (no rollup/plugin-typescript parse errors).
  - No functional/runtime changes in downstream behavior; this is a typing/emit fix only.

Impact
- Any consumer invoking TypeScript or Typedoc over the published types will hit this failure on the current build. The fix is surgical and low-risk (import and type-site change only).

Alternatives considered
- Downstream patching or suppressions:
  - Not recommended (would require vendoring node_modules, weakening type safety, or turning off docs).
  - A version pin to a pre-refactor build isn’t viable given we depend on the latest type improvements (token-/index-aware types).

Requested timeline
- As soon as practical; this unblocks multiple repos adopting the new inference-first typing while keeping typed builds/docs green.

Contact
- Downstream consumer: @karmaniverous/entity-client-dynamodb
- This interop note authored here: .stan/interop/entity-manager/z-infer-dts-bug.md
