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
