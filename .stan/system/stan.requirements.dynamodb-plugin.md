# Project Requirements — DynamoDB get-dotenv plugin and versioned migration (authoritative)

Scope and purpose

- Provide a robust, host-aware get-dotenv CLI plugin “dynamodb” for table lifecycle, data migration, and local DynamoDB orchestration on top of `@karmaniverous/entity-client-dynamodb` and `EntityManager`.
- Support versioned table definitions and transforms with strong typing, comment-preserving YAML refresh, and streaming, large-scale migrations.
- Keep `EntityClient` pure and type-safe for application code; dynamic versioned resolution lives in plugin utilities/services only.
- Commander integration MUST be fully typed using `@commander-js/extra-typings` and follow the shipped aws plugin patterns; detailed CLI typing and aws-pattern excerpts are specified in `.stan/system/stan.requirements.dynamodb-plugin.cli-typing.md`.

Versioned layout (opinionated; configurable tokens)

- Default root: `tables/` (configurable via `tablesPath`).
- Per-version directory `NNN/` (zero-padded):
  - `entityManager.ts` — value-first EM config for that version (typed; optional, see resolution).
  - `table.yml` — full `AWS::DynamoDB::Table` resource including `Type` and `Properties` (required for create-table).
  - `transform.ts` — optional, per-entity transform handlers from previous → this version.
- Root baseline template (optional): `tables/table.template.yml` for non-generated `Properties` (billing, TTL, PITR, Streams, SSE, tags, etc.).
- Configurable tokens (plugin/utilities only; not part of EntityClient):
  - `tablesPath` (default `"tables"`)
  - `tokens.table` (default `"table"` → `table.yml`)
  - `tokens.entityManager` (default `"entityManager"` → `entityManager.ts`)
  - `tokens.transform` (default `"transform"` → `transform.ts`)
- File resolution supports `.yml`/`.yaml` and `.ts`/`.js`.

EntityManager resolution per step (prev → next)

- For a chain step `V`, resolve both the “prev EM” and the “next EM”:
  - Try `V/entityManager.(ts|js)`; if absent, walk backward to the nearest lower version that defines `entityManager.(ts|js)`.
  - If no EM is found across the ancestry for the requested role (prev or next), error with guidance to add an EM file or set an earlier floor version.
- Rationale:
  - Default transform behavior requires `prev.removeKeys` and `next.addKeys`.
  - This allows a “next EM” to be absent when only non-updatable properties changed (fallback applies).

Table definition generation and refresh (comment-preserving)

- `generate-table-definition`:
  - Compose or refresh `tables/NNN/table.yml` using:
    - `Type: AWS::DynamoDB::Table`
    - `Properties`:
      - Replace only generated sections from `generateTableDefinition(entityManager)`:
        - `AttributeDefinitions`
        - `KeySchema`
        - `GlobalSecondaryIndexes`
      - Preserve all other `Properties` from:
        - Existing `table.yml` (when refreshing), or
        - Root baseline `tables/table.template.yml` (when creating new), or
        - Empty object (no baseline).
  - YAML comment preservation is critical:
    - Parse into a CST-backed Document (eemeli/yaml).
    - Update only the three generated child nodes under `Properties`; keep comments/anchors/order elsewhere.
  - Warning banner (YAML comment at top of file) MUST be present:
    - Generated sections (`AttributeDefinitions`, `KeySchema`, `GlobalSecondaryIndexes`) are overwritten by tooling; edit non-generated properties in `table.yml` or root template; use validate-table-definition to check drift.
  - Optional generation-time overlays (applied once onto `Properties`):
    - `BillingMode`, `ProvisionedThroughput` (RCU/WCU), `TableName`.
  - No per-version template; only a root baseline template.

Validation and create-table policy

- `validate-table-definition`:
  - Recompute the generated sections from resolved EM and compare to `table.yml`.
  - Exit non-zero on drift (CI-friendly).
- `create-table`:
  - Reads `tables/NNN/table.yml` (required; errors if missing).
  - Defaults: `validate=true`, `refreshGenerated=false`.
  - Behavior:
    - If `refreshGenerated`: update generated nodes in place (preserving comments/other properties) then create.
    - Else if `validate=true`: error on drift unless `--force` is provided.
  - TableName override:
    - Optional flag allows a one-off override (merged into `Properties` at runtime only, does not rewrite YAML).
  - Waiter:
    - `maxSeconds` configurable (default 60).

Delete and purge

- `delete-table`:
  - TableName from flags/config/env; confirm unless `--force`; waiter with `maxSeconds`.
- `purge-table`:
  - TableName from flags/config/env; confirm unless `--force`.

Data migration (version-aware chain; streaming; progress)

- `migrate-data`:
  - Inputs:
    - `sourceTable`, `targetTable` (dotenv-expanded).
    - `fromVersion`, `toVersion` (zero-padded).
    - `tablesPath` and `tokens` for versioned layout.
    - `pageSize` (default 100), `limit` (default Infinity).
    - `transformConcurrency` (default 1).
    - `progressIntervalMs` (default 2000).
  - Discovery:
    - Build step list `K = { k | fromVersion < k <= toVersion }` in ascending order.
    - For each `k`, resolve prev EM and next EM using fallback rules above.
    - Load `transform.(ts|js)` if present; otherwise use default chain for all entities.
  - Chain semantics (mandatory):
    - Missing transform module ⇒ default step for all entities:
      - `item = prev.removeKeys(entityToken, record)`
      - `record' = next.addKeys(entityToken, item)`
      - migrate `record'`
    - Present transform module ⇒ handlers apply for listed entities; unlisted use default chain.
  - TransformMap authoring (typed; async OK):
    - Handlers receive `(record, ctx)` where:
      - `record` is the storage-facing record for the prev EM.
      - `ctx` is `{ prev, next, entityToken }`.
    - Return values:
      - `undefined` → drop (no migration for this input record)
      - single item/record → migrate one
      - array of items/records → fan-out; migrate all (same entity token)
    - Side effects permitted (async); `transformConcurrency` controls parallelism (default 1).
  - Streaming and batching:
    - Scan pages from source with `Limit=pageSize` and `ExclusiveStartKey`.
    - Determine `entityToken` from the source record’s global hashKey string prefix (entity + shardKeyDelimiter from EM config).
    - Apply transform chain; normalize outputs to storage records for the next step (call `next.addKeys` if transform returns an item).
    - Batch write to target via `EntityClient.putItems(items, { tableName: targetTable })`.
    - No whole-table accumulation; memory bounded by page + in-flight batches; unprocessed items retried via EntityClient utilities.
  - Progress output:
    - Pages processed, items processed, items written, rolling items/sec emitted every `progressIntervalMs`.

Transform typing patterns (DX)

- Each version’s `transform.ts` imports types from its local EM to be step-accurate:
  - `import type { ConfigMap as PrevCM } from '../NNN-1/entityManager'`
  - `import type { ConfigMap as NextCM } from './entityManager'`
  - `export default defineTransformMap<PrevCM, NextCM>({ ...handlers... })`
- We provide `defineTransformMap<PrevCM, NextCM>(map)` helper for type-safety.
- Cross-entity fan-out is not supported in v1; all outputs are interpreted for the same entity token.

get-dotenv integration (config, env tokens, precedence)

- Plugin reads once-per-invocation context from host (`ctx = cli.getCtx()`).
- Resolution precedence for any option:
  - CLI flags (expanded once by the plugin when applicable) > plugin config slice (already interpolated once by the host) > documented defaults.
- Plugin reads config via `plugin.readConfig(cli)` (not via `ctx.pluginConfigs[...]`) because config is keyed by realized mount path (e.g., `aws/dynamodb`).
- Shell/env/capture behavior for any subprocesses:
  - Compose env via `buildSpawnEnv(process.env, ctx.dotenv)` and pass to child processes.
  - Use `readMergedOptions(thisCommand)` to read root bag and `shouldCapture(bag.capture)` to decide capture.
  - Prefer running config command strings under a shell; prefer argv arrays with `shell: false` for programmatic flows.

Local DynamoDB orchestration (config-first with embedded fallback)

Goal

- Provide simple, deterministic Local DynamoDB lifecycle under the plugin without forcing a single tool; prefer config-driven commands first, use embedded fallback when the optional library is available.

Commands (subtree: `dynamodb local`)

- `dynamodb local start [--port <n>]`
- `dynamodb local stop`
- `dynamodb local status`

Behavior and precedence (per command)

- Config-driven path (preferred when configured):
  - Execute command strings from `plugins.dynamodb.local.{start|stop|status}` in get-dotenv’s composed environment.
  - Start: after the configured start command returns, perform a readiness check before returning success.
  - Status: when a status command is configured, return its exit code (0 = healthy).
  - Stop: execute and return non-zero on operational failure.
- Embedded fallback (only when no config command is set):
  - If `@karmaniverous/dynamodb-local` is installed (optional peer):
    - Start: `setupDynamoDbLocal(port)` then `dynamoDbLocalReady(client)`.
    - Stop: `teardownDynamoDbLocal()`.
    - Status: AWS SDK health probe against the derived endpoint (ListTables with retry/backoff).
  - Otherwise: emit concise guidance and return non-zero.

No separate “ready” command (integrated readiness)

- Start blocks until Local is healthy (library readiness preferred; else SDK probe).
- Status remains a separate CI-friendly health check.

Endpoint derivation

- Precedence:
  - `plugins.dynamodb.local.endpoint`
  - `plugins.dynamodb.local.port` → `http://localhost:{port}`
  - `DYNAMODB_LOCAL_ENDPOINT` (env)
  - Fallback: `http://localhost:${DYNAMODB_LOCAL_PORT ?? '8000'}`
- On successful start, print:
  - `local dynamodb: endpoint <url>`
  - `Hint: export DYNAMODB_LOCAL_ENDPOINT=<url> so app code targets Local.`

Exit codes

- Start: 0 on healthy after readiness; non-zero on operational or readiness failure.
- Status: 0 when healthy/running; non-zero otherwise.
- Stop: non-zero on operational failure.

Commander + host integration details

- The detailed aws-pattern requirements for fully typed Commander usage, typed plugin instance seams, strict numeric parsing, dynamic help defaults scope, and fixtures-first testing are defined in `.stan/system/stan.requirements.dynamodb-plugin.cli-typing.md` and MUST be followed.
