# Development plan

## Next up (priority order)

- Align codebase to entity-manager vNext by-token type model (no back-compat shims)
  - Replace legacy types with by-token types across the repo:
    - EntityItemByToken -> EntityItem / EntityItemPartial
    - EntityRecordByToken -> EntityRecord / EntityRecordPartial
    - ProjectedItemByToken -> EntityItemPartial
  - Re-export types: Projected from entity-manager (remove local duplicate).
  - Update imports in:
    - src/EntityClient/\*\*
    - src/QueryBuilder/\*\*
    - src/get-dotenv/types.ts
    - src/index.ts (public re-exports)

- Simplify read APIs to token-aware forms only (no tokenless overloads)
  - EntityClient.getItem/getItems:
    - getItem(entityToken, key[, attributes as const])
    - getItems(entityToken, keys[, attributes as const])
  - Return types:
    - Without attributes -> EntityRecord<CC, ET>
    - With attributes (const tuple) -> EntityRecordPartial<CC, ET, A>
  - Update method implementations and helper modules under src/EntityClient/methods/\*\*
  - Update tests to use token-aware overloads exclusively

- QueryBuilder alignment
  - Replace cast from ProjectedItemByToken[] to EntityItemPartial[] in getShardQueryFunction
  - Preserve runtime invariant in query(): auto-include uniqueProperty + explicit sort keys when any projection is present
  - Verify IndexParams/Index tokens typing remains intact (ITS via client-captured CF)

- get-dotenv plugin types and services
  - Update TransformHandler typing in src/get-dotenv/types.ts:
    - record: EntityRecord<PrevCM, ET>
    - returns: undefined | EntityItem<NextCM, ET> | EntityRecord<NextCM, ET> | (array of those)
  - Sanity check migrate/services; ensure addKeys normalization is applied when transform returns items

- Lint & type fixes
  - Resolve “any overrides” diagnostics in EntityClient and methods
  - Ensure method return types are explicitly typed to the new model
  - Run: npm run lint && npm run typecheck

- Docs update (guides + re-exports)
  - Replace old names in examples (EntityItemByToken/EntityRecordByToken/ProjectedItemByToken)
  - Keep projection K explanations; note uniform projection advice
  - Confirm CLI plugin docs remain accurate (table lifecycle, migrate, local)

- Release notes (internal)
  - Briefly summarize type-surface changes; token-less read overloads removed
  - Note unchanged runtime behavior; DX improvements and consistency
  - Coordinate major version bump if needed

## Completed

**CRITICAL: Append-only list. Add new completed items at the end. Prune old completed entries from the top. Do not edit existing entries.**

- Docs: compact README + TypeDoc guides (core & CLI Plugin section with index)
  - Replaced long README with landing page and bulleted index.
  - Added targeted guides under docs/guides and docs/guides/cli with children front matter on CLI index.
  - Updated typedoc.json projectDocuments to include all guides.
- Local DynamoDB orchestration — code foundations
  - Types/config: added DynamodbPluginConfig.local without “ready”.
  - Services: services/local.ts with deriveEndpoint, config-command exec (execaCommand), health probes (library preferred, SDK fallback), and start/stop/status orchestrators using buildSpawnEnv and capture/stdio precedence.
  - CLI wiring: commands/local.ts registering “dynamodb local start|stop|status”; integrated into plugin index; start blocks until healthy and prints endpoint + export hint; status returns 0 when healthy.

  - Wiring tests for commands/local (mocked services; asserted env/shell/capture and port override; verified outputs/exitCode).
  - Unit tests for services/local (deriveEndpoint; statusLocal config path success/failure).

- Local DynamoDB orchestration — docs
  - Added guides/cli/local-dynamodb.md and linked from CLI Plugin index.
  - Documented config-first + embedded fallback, endpoint derivation, and start waiting for readiness.

- Docs: linked Local DynamoDB guide from CLI Plugin section (guides/cli/index.md).

- Interop: removed QueryBuilder cf parameter; derive ITS/CF automatically from EntityClient via upstream CF preservation.
  Updated createQueryBuilder, tsd tests (range-key), and docs (querying guide, type inference model).

- Follow-through: fix typecheck to build dist before tsd; resolve ESLint issues by refining QueryBuilder signature and removing conditional expect in migrate wiring test; update Querying guide note to reflect automatic index inference.

- Docs pass: update README guide index to replace “config‑literal cf” with
  “values‑first config (automatic index inference)” to match the new API and
  updated guides.

- Requirements synthesis (by-token + plugin)
  - Merged Entity Manager requirements and DynamoDB plugin requirements into a single authoritative document.
  - Updated terminology and type references to the by-token model (EntityItem*, EntityRecord*).

- Typecheck: updated tsd test (test-d/querybuilder-projection-k.test-d.ts) to by-token types.
  Replaced EntityItemByToken with EntityItem/EntityItemPartial and aligned
  expectations for projected and reset-projection cases.

- Lint: removed non-null assertions in EntityClient methods/getItems.ts by deriving
  a fallback tableNameKey. ESLint no-non-null-assertion satisfied.

- Typecheck: updated tsd test (test-d/querybuilder-projection-k.test-d.ts) to by-token types.
  Replaced EntityItemByToken with EntityItem/EntityItemPartial and aligned
  expectations for projected and reset-projection cases.

- Lint: removed non-null assertions in EntityClient methods/getItems.ts by deriving
  a fallback tableNameKey. ESLint no-non-null-assertion satisfied.

- Docs: update token-aware reads in examples
  - README Quick start now uses client.getItem('user', key).
  - Getting Started guide "Put / Get" now uses token-aware getItem.

- get-dotenv plugin host model migration (dynamodb)
  - Switched to `definePlugin({ ns, configSchema })` and `plugin.readConfig(cli)`; removed brittle `ctx.pluginConfigs.dynamodb` access.
  - Made AWS-safe defaults when run under shipped `aws` plugin (no forced localhost endpoint/creds); expand flags only to avoid config double-expansion.