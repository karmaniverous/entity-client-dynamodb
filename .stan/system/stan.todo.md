# Development plan

## Next up (priority order)

- Audit for any remaining references to old overlay/force semantics in code/docs and remove.

## Completed

**CRITICAL: Append-only list. Add new completed items at the end. Prune old completed entries from the top. Do not edit existing entries.**

- Updated requirements to unify DynamoDB CLI semantics: numeric version ordering with `minTableVersionWidth`, managed table properties (`generate.tableProperties` + `--table-*` flags), `generate --clean` (no `--force`), `create` latest-only guard with `--allow-non-latest`, and order-insensitive drift validation including managed properties.
- Implemented managed table properties application/invariant checks in YAML writer utilities (compose/refresh) via `src/get-dotenv/tableDefinition.ts`.
- Fixed get-dotenv services to use the new numeric version layout API (replace removed getVersionedPaths with resolveVersionDir + getVersionedPathsForToken) and cleaned up tableProperties lint.
- Fixed remaining generate service type/lint issues after layout API refactor (remove stale getVersionedPaths type reference; tighten tableProperties narrowing).
- Enforced latest-only table creation by default (all envs) with an explicit `--allow-non-latest` override.
- Enforced migrate boundary existence: both `fromVersion` and `toVersion` must exist as version directories before migrating.
- Implemented managed table properties config/CLI rename (`generate.tableProperties`, `--table-*`) and `generate --clean` (removed `--force`).
- Made validation order-insensitive for generated sections and added managed table properties drift validation when configured.
- Fixed CLI command import paths for tableProperties and stabilized validation diffs against YAML key-order differences.
- Normalized YAML CST nodes to plain JS before drift comparison and fixed validate.ts lint violations.
- Updated CLI docs to assume `aws dynamodb ...` and `plugins["aws/dynamodb"]`, and documented `generate --clean` and managed table properties flags (`--table-*`).
- Aligned README and guides with current implementation details (aws/dynamodb config namespace, create latest-only guard, managed table properties invariants, version token semantics, projection wording).- Continued doc pass: de-duplicated README CLI plugin section, restored License section, and normalized stray CR characters in touched guides for reliable copy/paste.