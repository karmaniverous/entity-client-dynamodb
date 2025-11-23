# Development plan

## Next up (priority order)

- Introduce versioned layout utilities (no EntityClient changes)
  - Implement tokenized layout loader (tablesPath; tokens.table/entityManager/transform).
  - Resolve prev/next EntityManagers per step with fallback (walk backward).
  - Load transform.ts per version (TS/JS), normalize to TransformMap.
  - Export defineTransformMap<PrevCM, NextCM>() for typed authoring.

- YAML refresh (comment-preserving) and validation
  - Use yaml Document API with CST to update only generated nodes:
    • Properties.AttributeDefinitions
    • Properties.KeySchema
    • Properties.GlobalSecondaryIndexes
  - Preserve all other nodes and comments in tables/NNN/table.yml.
  - Implement validate-table-definition to compare generated nodes against EM.
  - Write banner comment to table.yml warning about generated sections.

- CLI plugin (host-aware) “dynamodb” and subcommands
  - Installable via get-dotenv host (per Guides).
  - Commands:
    • generate-table-definition (with root baseline overlay; --force; overlays)
    • validate-table-definition
    • create-table (validate by default; --refresh-generated; waiter; TableName override)
    • delete-table (confirm unless --force; waiter)
    • purge-table (confirm unless --force)
    • migrate-data (fromVersion→toVersion; streaming; chain)
  - Respect get-dotenv config precedence and dotenv expansion for all options.

- Migrate-data streaming & progress
  - Page-scan source (Limit=pageSize); per-record entity token from hashKey prefix.
  - Apply mandatory chain:
    • Missing transform → prev.removeKeys + next.addKeys
    • TransformMap handlers may be async; returning undefined drops; arrays fan-out
  - Normalize outputs to next records (addKeys when item returned).
  - Batch write via EntityClient.putItems with retries.
  - Emit progress (pages, records, outputs, items/sec) at interval.
  - Flags: pageSize, limit, concurrency, transformConcurrency (default 1), progress interval.

- Config plumbing & precedence
  - plugins.dynamodb config surface in getdotenv.config.\* with dotenv expansion.
  - Effective options: CLI > config > defaults; resolve strings via ctx.dotenv.
  - Add debug/trace logging that respects host redaction/entropy settings.

- Tests
  - Unit:
    • EM resolution fallback (prev/next), transform loader normalize (TS/JS).
    • YAML comment-preserving refresh + drift detection.
    • Chain composition and TransformMap returns (undefined, single, array).
  - Integration (DynamoDB Local):
    • create-table validate/refresh; purge/delete.
    • migrate-data (no transforms; with TransformMap; fan-out; drop).
  - TSD:
    • defineTransformMap<PrevCM, NextCM> typing for per-entity handlers.
    • TransformMap returns (undefined/item/record/array) compile as expected.

- Documentation
  - Add requirements doc (done) and authoring guide:
    • Versioned layout and tokens
    • entityManager.ts structure (values-first)
    • Transform authoring using defineTransformMap<PrevCM, NextCM>
    • Baseline template and comment-preserving refresh
    • Serverless.yml import examples
    • get-dotenv config snippets with env overlays
  - Update README to reference the new plugin and examples.

- Follow-up on legacy monolith:
  - Reconcile current .stan/system/stan.requirements.md (legacy, >300 LOC).
  - Propose decomposition into topical requirements docs (keep monolith read-only) and link from a lightweight index.

## Completed

**CRITICAL: Append-only list. Add new completed items at the end. Prune old completed entries from the top. Do not edit existing entries.**

- Scaffold get-dotenv plugin root and utilities
  - Added src/getdotenv with typed TransformMap (async+fan-out+drop), versioned
    layout resolvers (tokenized; fallback EM resolution), and YAML refresh utilities
    using yaml Document API (CST) to preserve comments while overwriting generated
    sections only. Re-exported from package root and added yaml dependency.

- Rename plugin path and add subpath export
  - Moved plugin root to src/get-dotenv to reflect package name.
  - Added dedicated subpath export "./get-dotenv" in package.json pointing to
    dist/mjs/get-dotenv/index.js (ESM) and dist/cjs/get-dotenv/index.js (CJS),
    with types resolved via dist/index.d.ts.

- Validation helper for generated sections
  - Added src/get-dotenv/validate.ts to compare YAML-generated sections against
    the EntityManager output and return a structured diff. Exported via the
    plugin barrel for use by the upcoming validate-table-definition and
    create-table (validate) commands.

- Versioned EM loader and initial services
  - Added src/get-dotenv/emLoader.ts to resolve+load versioned EntityManagers
    using the fallback rules (walk backward).
  - Implemented services:
    • generateTableDefinitionAtVersion (compose or refresh; comment-preserving).
    • createTableAtVersion (validate by default; refresh-generated option; waiter;
      runtime TableName override). Extracts Properties safely from YAML and invokes
      EntityClient.createTable.
  - Exported loaders/services from the plugin barrel.

- Fix lint/type-safety in get-dotenv utilities
  - emLoader: removed unsafe any assignments by narrowing dynamic import result
    and checking default export key presence.
  - generate: removed unnecessary await on sync function to satisfy lint rules.

- Lint: remove unnecessary String() conversion in get-dotenv tableDefinition
  - Replaced props.set(String(key), value) with props.set(key, value) in
    src/get-dotenv/tableDefinition.ts to satisfy @typescript-eslint/no-unnecessary-type-conversion.