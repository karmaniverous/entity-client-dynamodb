# Project Requirements — DynamoDB get-dotenv plugin and versioned migration (authoritative)

Scope and purpose

- Provide a robust, host-aware get-dotenv CLI plugin “dynamodb” for table lifecycle, data migration, and local DynamoDB orchestration on top of `@karmaniverous/entity-client-dynamodb` and `EntityManager`.
- Support versioned table definitions and transforms with strong typing, comment-preserving YAML refresh, and streaming, large-scale migrations.
- Keep `EntityClient` pure and type-safe for application code; dynamic versioned resolution lives in plugin utilities/services only.
- Commander integration MUST be fully typed using `@commander-js/extra-typings` and follow the shipped aws plugin patterns; detailed CLI typing and aws-pattern excerpts are specified in `.stan/system/stan.requirements.dynamodb-plugin.cli-typing.md`.

Canonical mounting (authoritative)

- The expected usage of this plugin is as a child of the shipped get-dotenv `aws` plugin.
- Documentation and examples SHOULD assume commands are invoked as `aws dynamodb ...` and config is keyed by the realized mount path `plugins["aws/dynamodb"]`.
- Root-mounting at `dynamodb ...` is permitted but not the recommended/assumed configuration.

Versioned layout (opinionated; configurable tokens)

- Default root: `tables/` (configurable via `tablesPath`).
- Per-version directory `<token>/` (directory token is cosmetic; see “Version ordering and width”):
  - `entityManager.ts` — value-first EM config for that version (typed; optional, see resolution).
  - `table.yml` — full `AWS::DynamoDB::Table` resource including `Type` and `Properties` (required for create-table).
  - `transform.ts` — optional, per-entity transform handlers from previous → this version.
- Root baseline template (optional): `tables/table.template.yml` for non-generated `Properties` (billing, TTL, PITR, Streams, SSE, tags, etc.).
- Configurable tokens (plugin/utilities only; not part of EntityClient):
  - `tablesPath` (default `"tables"`)
  - `tokens.table` (default `"table"` → `table.yml` / `table.yaml`)
  - `tokens.entityManager` (default `"entityManager"` → `entityManager.ts/.js`)
  - `tokens.transform` (default `"transform"` → `transform.ts/.js`)
- File resolution supports `.yml`/`.yaml` and `.ts`/`.js`.

Version ordering and width (authoritative)

- All version comparisons and step ordering MUST be by numeric value, not lexicographic ordering of directory tokens.
- A config key controls cosmetic padding when emitting “canonical” tokens:
  - `minTableVersionWidth: int` (default 3)
  - This is a minimum width for left-zero padding when formatting a version value as a token.
  - Tokens may exceed this width naturally (e.g., width=2 permits `99/` then `100/`).
- Directory discovery MUST accept any digit-only directory name (`^\d+$`) under `tablesPath`.
- Duplicate numeric values across directory tokens (e.g., `1/` and `001/`) MUST be treated as a hard error with actionable guidance to remove/rename one directory.

EntityManager resolution per step (prev → next)

- For a chain step V, resolve both the “prev EM” and the “next EM”:
  - Try `V/entityManager.(ts|js)`; if absent, walk backward to the nearest lower version (by numeric value) that defines `entityManager.(ts|js)`.
  - If no EM is found across the ancestry for the requested role (prev or next), error with guidance to add an EM file or set an earlier floor version.
- Rationale:
  - Default transform behavior requires `prev.removeKeys` and `next.addKeys`.
  - This allows a “next EM” to be absent when only non-updatable properties changed (fallback applies).

Table definition generation and refresh (comment-preserving)

- `generate`:
  - Compose or refresh `tables/<version>/table.yml` using:
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
    - Update only the generated child nodes under `Properties`; keep comments/anchors/order elsewhere.
  - Warning banner (YAML comment at top of file) MUST be present:
    - Generated sections (`AttributeDefinitions`, `KeySchema`, `GlobalSecondaryIndexes`) are overwritten by tooling; edit non-generated properties in `table.yml` or root template; use validate to check drift.

Managed table properties (NOT dotenv overlays; authoritative)

- Config/flags may optionally declare a small set of non-generated table `Properties` keys as “managed by tooling”:
  - `BillingMode`
  - `ProvisionedThroughput` (RCU/WCU)
  - `TableName`
- When configured/provided, these managed table properties MUST be applied deterministically on every `generate` refresh (in addition to generated sections).
- When not configured/provided, these keys MUST be preserved (no mutation).
- Throughput management MUST NOT introduce implicit behavior:
  - If `ProvisionedThroughput` is managed, `BillingMode` MUST also be explicitly managed and MUST be `PROVISIONED`.
  - If `BillingMode` is managed as `PROVISIONED`, `ProvisionedThroughput` MUST be present and complete (RCU+WCU) or `generate` MUST error.

Generate CLI UX (authoritative)

- `generate` MUST NOT expose `--force`.
- `generate` MUST expose `--clean`:
  - `--clean` regenerates `table.yml` from scratch using the root baseline template (if present) + generated sections + managed table properties.
  - `--clean` does not require confirmation (local change; rollback is trivial).

Validation and create-table policy

- `validate`:
  - Recompute the generated sections from resolved EM and compare to `table.yml` (order-insensitive; DynamoDB-aware canonicalization).
  - When managed table properties are configured (see `generate.tableProperties` below), validate MUST also enforce drift detection for those managed keys.
  - Exit non-zero on drift (CI-friendly).
- `create`:
  - Reads `tables/<version>/table.yml` (required; errors if missing).
  - Defaults: `validate=true`, `refreshGenerated=false`.
  - Behavior:
    - If `refreshGenerated`: update generated nodes AND apply managed table properties in place (preserving comments/other properties) then create.
    - Else if `validate=true`: error on drift unless `--force` is provided (drift includes managed properties when configured).
  - Non-latest create guard (authoritative):
    - Creating a table at a non-latest version is unsafe by default and MUST be rejected in all environments.
    - The CLI MUST support an explicit override flag `--allow-non-latest` to permit creating a non-latest version.
  - TableName override:
    - Optional flag allows a one-off override (merged into `Properties` at runtime only, does not rewrite YAML).
  - Waiter:
    - `maxSeconds` configurable (default 60).

Delete and purge

- `delete`:
  - TableName from flags/config/env; confirm unless `--force`; waiter with `maxSeconds`.
- `purge`:
  - TableName from flags/config/env; confirm unless `--force`.

Data migration (version-aware chain; streaming; progress)

- `migrate`:
  - Version existence guard (authoritative):
    - Both `fromVersion` and `toVersion` MUST correspond to existing version directories under `tablesPath` (numeric value match).
    - If either boundary does not exist, migration MUST error with actionable guidance (never silently no-op).
  - Inputs:
    - `sourceTable`, `targetTable` (dotenv-expanded).
    - `fromVersion`, `toVersion` (numeric; ordering by numeric value).
    - `tablesPath` and `tokens` for versioned layout.
    - `pageSize` (default 100), `limit` (default Infinity).
    - `transformConcurrency` (default 1).
    - `progressIntervalMs` (default 2000).
  - Discovery:
    - Build step list `K = { k | fromVersion < k <= toVersion }` in ascending numeric order.
    - For each k, resolve prev EM and next EM using fallback rules above.
    - Load `transform.(ts|js)` if present; otherwise use default chain for all entities.
  - Chain semantics (mandatory):
    - Missing transform module ⇒ default step for all entities:
      - `item = prev.removeKeys(entityToken, record)`
      - `record' = next.addKeys(entityToken, item)`
      - migrate `record'`
    - Present transform module ⇒ handlers apply for listed entities; unlisted use default chain.
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
- Provide `defineTransformMap<PrevCM, NextCM>(map)` helper for type-safety.
- Cross-entity fan-out is not supported in v1; all outputs are interpreted for the same entity token.

get-dotenv integration (config, env tokens, precedence)

- Plugin reads once-per-invocation context from host (`ctx = cli.getCtx()`).
- Resolution precedence for any option:
  - CLI flags (expanded once by the plugin when applicable) > plugin config slice (already interpolated once by the host) > documented defaults.
- Plugin reads config via `plugin.readConfig(cli)` (not via `ctx.pluginConfigs[...]`) because config is keyed by realized mount path (e.g., `aws/dynamodb`).
- Version flag strictness (authoritative):
  - Commands that operate on a version (`generate`, `validate`, `create`, `migrate`) MUST require an explicit version value after host/config interpolation (no implicit default-to-latest).
  - Missing/empty/non-numeric versions MUST error with guidance.
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

Plugin config shape updates (authoritative; for docs/validation)

- Add: `minTableVersionWidth` (default 3).
- Update generate config naming:
  - Replace `generate.overlays` with `generate.tableProperties` (managed table properties).
- Managed table properties config shape:
  - `generate.tableProperties.billingMode` (string; required if managing throughput; `PROVISIONED` required when managing throughput).
  - `generate.tableProperties.readCapacityUnits` (number|string).
  - `generate.tableProperties.writeCapacityUnits` (number|string).
  - `generate.tableProperties.tableName` (string).
- CLI flag naming updates (generate; managed table properties):
  - Prefer `--table-billing-mode`, `--table-rcu`, `--table-wcu`, `--table-name` (consistent `table-` prefix).
- CLI flag updates (generate):
  - Remove `--force` and replace with `--clean` (regenerate from scratch from baseline template + generated + managed properties).
- CLI flag updates (create):
  - Add `--allow-non-latest` to override latest-only create guard.

Commander + host integration details

- The detailed aws-pattern requirements for fully typed Commander usage, typed plugin instance seams, strict numeric parsing, dynamic help defaults scope, and fixtures-first testing are defined in `.stan/system/stan.requirements.dynamodb-plugin.cli-typing.md` and MUST be followed.
