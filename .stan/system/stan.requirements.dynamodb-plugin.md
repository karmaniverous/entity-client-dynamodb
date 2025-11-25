# Project Requirements — DynamoDB get-dotenv plugin and versioned migration (authoritative)

Scope and purpose

- Provide a robust, host-aware get-dotenv CLI plugin “dynamodb” for table lifecycle and data migration on top of @karmaniverous/entity-client-dynamodb and EntityManager.
- Support versioned table definitions and transforms with strong typing, comment-preserving YAML refresh, and streaming, large-scale migrations.
- Keep EntityClient pure and type-safe for application code; dynamic versioned resolution lives in plugin/utilities only.

Versioned layout (opinionated; configurable tokens)

- Default root: tables/ (configurable via tablesPath)
- Per-version directory “NNN/” (zero-padded):
  - entityManager.ts — value-first EM config for that version (typed; optional, see resolution below).
  - table.yml — full AWS::DynamoDB::Table resource including Type and Properties (required for create-table).
  - transform.ts — optional, per-entity transform handlers from previous→this version.
- Root baseline template (optional): tables/table.template.yml for non-generated Properties (billing, TTL, PITR, Streams, SSE, tags, etc.).
- Configurable tokens (not part of EntityClient; provided via plugin/utilities):
  - tablesPath (default "tables")
  - tokens.table (default "table" → table.yml)
  - tokens.entityManager (default "entityManager" → entityManager.ts)
  - tokens.transform (default "transform" → transform.ts)
- File resolution supports .yml/.yaml and .ts/.js.

EntityManager resolution per step (prev → next)

- For a chain step V, we must resolve both the “prev EM” and the “next EM”:
  - Try V/entityManager.(ts|js); if absent, walk backward to the nearest lower version that defines entityManager.(ts|js).
  - If no EM is found across the ancestry for the requested role (prev or next), error with guidance to add an EM file or set an earlier floor version.
- Rationale:
  - Default transform behavior requires prev.removeKeys and next.addKeys.
  - This allows next EM to be optional when only non-updatable properties changed (e.g., TableName) because fallback applies.

Table definition generation and refresh (comment-preserving)

- generate-table-definition:
  - Compose or refresh tables/NNN/table.yml using:
    - Type: AWS::DynamoDB::Table
    - Properties:
      - Replace only generated sections from generateTableDefinition(entityManager):
        - AttributeDefinitions
        - KeySchema
        - GlobalSecondaryIndexes
      - Preserve all other Properties from:
        - Existing table.yml (when refreshing), or
        - Root baseline tables/table.template.yml (when creating new file), or
        - Empty object (no baseline).
  - YAML comment preservation is critical:
    - Parse into a CST-backed Document (eemeli/yaml).
    - Update only the three generated child nodes under Properties; keep all comments/anchors/order elsewhere.
  - Warning banner (YAML comment at top of file):
    - “Generated sections (AttributeDefinitions, KeySchema, GlobalSecondaryIndexes) are overwritten by generate-table-definition. Edit baseline/template-only. Use validate-table-definition to check drift.”
  - Optional CLI overlays at generation time (applied onto Properties once):
    - BillingMode, ProvisionedThroughput (RCU/WCU), TableName.
  - No per-version template; only a root baseline template (tables/table.template.yml).

Validation and create-table policy

- validate-table-definition:
  - Recompute the generated sections from resolved EM and compare to table.yml.
  - Exit non-zero on drift (CI-friendly).
- create-table:
  - Reads tables/NNN/table.yml (required; errors if missing).
  - Defaults: validate=true, refreshGenerated=false.
  - Behavior:
    - If refreshGenerated: update generated nodes in place (preserving comments/hand edits) then create.
    - Else if validate=true: error on drift unless --force is provided.
  - TableName override:
    - Optional flag allows a one-off override (merged into Properties at runtime only, does not rewrite YAML).
  - Waiter: maxSeconds configurable (default 60).

Delete and purge

- delete-table:
  - TableName from flags/config/env; confirm unless --force; waiter with maxSeconds.
- purge-table:
  - TableName from flags/config/env; confirm unless --force.

Data migration (version-aware chain; streaming; progress)

- migrate-data:
  - Inputs:
    - sourceTable, targetTable (dotenv-expanded).
    - fromVersion, toVersion (zero-padded).
    - tablesPath and tokens for versioned layout.
    - pageSize (default 100), limit (default Infinity).
    - concurrency (batch write concurrency), transformConcurrency (default 1).
    - progressIntervalMs (default 2000).
  - Discovery:
    - Build step list K = { k | fromVersion < k ≤ toVersion } in ascending order.
    - For each k, resolve prev EM and next EM (fallback rules above).
    - Load transform.ts if present; normalize to TransformMap (see below).
  - Chain semantics (mandatory):
    - Missing transform.ts ⇒ default step for all entities:
      - item = prev.removeKeys(entityToken, record)
      - record’ = next.addKeys(entityToken, item)
      - return record’
    - Present transform.ts ⇒ handlers apply for listed entities; unlisted use default step.
  - TransformMap authoring (typed; async OK):
    - Handlers receive (record, ctx) where:
      - record: EntityRecordByToken<PrevCM, ET>
      - ctx: { prev: EntityManager<PrevCM>; next: EntityManager<NextCM>; entityToken: ET }
    - Return values:
      - undefined → drop (no migration for this input record)
      - Single item (EntityItemByToken<NextCM, ET>) or record (EntityRecordByToken<NextCM, ET>) → migrate one
      - Array of items/records → fan-out; migrate all (same ET)
    - Side effects permitted (async); transformConcurrency controls parallelism (default 1).
  - Streaming and batching:
    - Scan pages from source with Limit=pageSize and ExclusiveStartKey.
    - For each page:
      - Determine entityToken from the source record’s global hashKey string prefix (entity + shardKeyDelimiter from EM config).
      - Apply transform chain; normalize items to storage records (call next.addKeys if item returned).
      - Batch write to target via EntityClient.putItems(items, { tableName: targetTable }).
    - No whole-table accumulation; memory bounded by page + in-flight batches; unprocessed items retried via EntityClient utils.
  - Progress output:
    - Pages processed, items processed, items written, rolling items/sec rate emitted every progressIntervalMs.

Transform typing patterns (DX)

- Each version’s transform.ts imports types from its local EM to be step-accurate:
  - import type { ConfigMap as PrevCM } from '../NNN-1/entityManager'
  - import type { ConfigMap as NextCM } from './entityManager'
  - export default defineTransformMap<PrevCM, NextCM>({ …handlers… })
- We provide defineTransformMap<PrevCM, NextCM>(map) helper for type-safety.
- Cross-entity fan-out is not supported in v1; all outputs are interpreted for the same ET. (Revisit if needed.)

EntityClient posture (pure) and IDE guidance

- EntityClient remains pure; it requires an EntityManager at construction and does not perform dynamic versioned resolution internally.
- Application code:
  - Choose the “current” EM once (usually latest) and pass it into new EntityClient({ entityManager, … }).
  - Downstream, import only entityClient; refer to entityClient.entityManager when needed.
- The plugin/utilities handle dynamic EM resolution at runtime for migrations/Lifecycle tasks.

get-dotenv integration (config, env tokens, precedence)

- Plugin reads once-per-invocation context from host (ctx = getCtx()).
- Every string option supports $VAR or ${VAR[:default]} and is expanded via dotenvExpand(value, ctx.dotenv).
- Resolution precedence for any option:
  1) CLI flag (dotenv-expanded) > 2) getdotenv.config.* under plugins.dynamodb (dotenv-expanded) > 3) documented defaults.
- Plugin config shape (getdotenv.config.* → plugins.dynamodb):
  - tablesPath, tokens.{table,entityManager,transform}
  - generate: { version, autoNext, overlay.{billingMode, readCapacityUnits, writeCapacityUnits, tableName} }
  - validate/create: { version, validate, refreshGenerated, waiter.maxSeconds, tableNameOverride }
  - delete: { tableName, waiter.maxSeconds }
  - purge: { tableName }
  - migrate: { sourceTable, targetTable, fromVersion, toVersion, pageSize, limit, concurrency, transformConcurrency, progressIntervalMs }
- The plugin is a host-aware get-dotenv plugin (install(host)):
  - Registers the “dynamodb” command group and subcommands for generate/validate/create/delete/purge/migrate.
  - Honors host diagnostics (strict, redact/entropy, capture, trace) via ctx.ns/options.

YAML safety and formatting

- We use the yaml Document API with CST to:
  - Update only the generated nodes (Properties.AttributeDefinitions, Properties.KeySchema, Properties.GlobalSecondaryIndexes).
  - Preserve all other nodes, order, and comments.
- New files (no table.yml):
  - Compose from root baseline (if present) + generated nodes + comment banner.
- validate-table-definition compares generated sections normalized for stable order.

Errors and confirmations

- Destructive ops (purge/delete/migrate) prompt for confirm unless --force is provided.
- EM resolution failures produce actionable errors (list probed paths); instruct adding entityManager.ts at V or a lower version.
- Drift validation errors suggest running “generate-table-definition --force” or “create-table --refresh-generated”.

Performance limits and safety

- pageSize default 100; concurrency limits for batch writing; transformConcurrency default 1 to make side effects safe by default.
- No unbounded buffering; rely on DocumentClient batch write retry semantics for unprocessed items.

Acceptance criteria

- Versioned layout respected with configurable tokens; utilities resolve prev/next EM and transforms per step with documented fallback.
- generate-table-definition preserves comments and all non-generated Properties across refresh; overwrites only generated sections; optional root baseline honored; header banner present.
- validate-table-definition detects drift in generated sections and exits non-zero.
- create-table validates by default; supports refresh-generated; waiter supported; optional TableName override at runtime only.
- migrate-data streams end-to-end with mandatory chain semantics:
  - Missing transform ⇒ default prev.removeKeys / next.addKeys.
  - TransformMap with async handling; returns undefined to drop; array to fan-out; normalized to next records as required.
  - Progress printed at interval; performance flags respected.
- EntityClient usage remains pure and type-safe in application code; dynamic versioned resolution is provided via plugin/utilities only.
- All flags/options can be supplied via getdotenv.config.* and/or CLI with dotenv expansion and precedence rules documented.

---

## Local DynamoDB orchestration (config-first with embedded fallback)

Goal
- Provide simple, deterministic “Local DynamoDB” lifecycle under the plugin without forcing a single tool. Favor config‑driven commands first; use an embedded fallback when the optional library is available.

Commands (subtree: dynamodb local)
- dynamodb local start [--port <n>]
- dynamodb local stop
- dynamodb local status

Behavior and precedence (per command)
1) Config‑driven path (preferred when configured)
   - Execute verbatim command strings from `plugins.dynamodb.local.*` in get‑dotenv’s composed environment.
   - For start: after the configured start command returns, perform a readiness check before returning success (see Readiness below).
   - For status: when a status command is configured, return its exit code verbatim (0 = running/healthy).
   - For stop: execute and return non‑zero on operational failure.

2) Embedded fallback (only when no config command is set)
   - If `@karmaniverous/dynamodb-local` is installed (optional peer):
     - start: `await setupDynamoDbLocal(port)` then `await dynamoDbLocalReady(client)`
     - stop: `await teardownDynamoDbLocal()`
     - status: SDK health probe (see below)
   - Otherwise, emit concise guidance and return non‑zero:
     - “Configure plugins.dynamodb.local.{start|stop|status} in getdotenv config, or install @karmaniverous/dynamodb-local for built‑in orchestration.”

No separate “ready” command (integrated readiness)
- The “ready” check is integrated into “start” (blocking semantics):
  - Embedded path: begin with `setupDynamoDbLocal(port)` and then await `dynamoDbLocalReady(client)` (match existing test usage).
  - Config path: after running the configured start command, perform a readiness probe before returning 0.
- Status remains distinct (0 = running/healthy), suitable for CI conditions.

Readiness probe (library first, else SDK)
- When the optional library is present: prefer `dynamoDbLocalReady(client)` regardless of whether Local was started by the library or by a config command.
- When the library is not present: perform an AWS SDK v3 health probe against the derived endpoint (e.g., ListTables with short retry/backoff).
- “status” uses the same healthy/not-healthy determination as the readiness probe.

Endpoint & environment
- Endpoint derivation (first match wins):
  1) `plugins.dynamodb.local.endpoint`
  2) `plugins.dynamodb.local.port` → `http://localhost:{port}`
  3) `process.env.DYNAMODB_LOCAL_ENDPOINT`
  4) Fallback: `http://localhost:${process.env.DYNAMODB_LOCAL_PORT ?? '8000'}`
- On successful start, print:
  - `local dynamodb: endpoint <url>`
  - `Hint: export DYNAMODB_LOCAL_ENDPOINT=<url> so app code targets Local.`
- Standardize env:
  - `DYNAMODB_LOCAL_ENDPOINT` — canonical endpoint variable used by app code
  - `DYNAMODB_LOCAL_PORT` — helper for deriving the endpoint

Config shape (plugin, no “ready” key)
```json
{
  "plugins": {
    "dynamodb": {
      "local": {
        "port": 8000,
        "endpoint": "http://localhost:8000",
        "start": "docker compose up -d dynamodb",
        "stop": "docker compose stop dynamodb",
        "status": "docker ps --format '{{.Names}}' | grep -q dynamodb"
      }
    }
  }
}
```
Notes
- Strings are interpolated by the host once before plugin execution.
- If you want a normalized resolver, a small optional `resolveLocal(flags, cfg, envRef)` may coerce numerics and defaults; not strictly required because the host already expands config strings.

Exit codes
- start: 0 on healthy after readiness; non‑zero on operational or readiness failure.
- status: 0 when healthy/running; non‑zero otherwise (CI‑friendly).
- stop: non‑zero on operational failure.

### Shell/exec behavior for plugin commands

Requirements (align with “Executing Shell Commands” guidance)
- Expansion boundary:
  - Config strings (plugin config) are already dotenv‑expanded by the host. Do not re‑expand in the plugin.
  - Runtime flags you accept are your choice; if expanded, expand once and document the behavior.
- Shell selection:
  - Use the merged root bag’s shell setting (default normalized by the host: `/bin/bash` on POSIX, `powershell.exe` on Windows).
  - For config command strings: run using a shell (execaCommand) respecting the root shell choice.
  - For programmatic/library flows: prefer argv arrays with `shell: false`.
- Child environment:
  - Compose env via `buildSpawnEnv(process.env, ctx.dotenv)` and pass it to child processes.
- Capture / CI diagnostics:
  - Honor `GETDOTENV_STDIO=pipe` or the root `capture: true` option. Use `stdio: 'pipe'` when capturing; otherwise inherit.
  - It is optional (but recommended) to mirror a concise trace line per key when debugging; redaction is a presentation‑time concern and must not alter runtime values.
- Quoting:
  - With shell‑on commands (config strings), the selected shell governs quoting rules. Recommend single quotes for literal strings in docs/examples.

Implementation notes (small services)
- Services should remain pure and thin (ports/adapters):
  - deriveEndpoint({ cfg, envRef, overridePort? })
  - runConfigCommand(cmd: string, env, shell, capture) → exit code
  - startLocal/stopLocal/statusLocal: branch config vs library fallback; share health probe utilities (library or SDK).
- Command wiring should read the merged root options bag for shell/capture, compose env via buildSpawnEnv, and defer to services.

Acceptance updates (local orchestration)
- Provide the three commands under the plugin namespace (`dynamodb local start|stop|status`).
- No separate “ready” command; start waits until Local is healthy (library first, else SDK probe).
- Config‑first behavior with embedded fallback using `@karmaniverous/dynamodb-local` when available.
- Respect endpoint derivation and print endpoint + export hint on successful start.
- Use get‑dotenv’s composed env via `buildSpawnEnv` and shell/capture precedence from the merged root options bag.
- Remove `local.ready` from the config shape; do not introduce a separate “ready” command or config hook.