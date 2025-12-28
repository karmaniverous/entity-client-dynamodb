# Development plan

## Next up (priority order)

- Re-run `npm run docs`; fix any `validation.notDocumented` warnings until 0 (this is the “complete TypeDoc pass” gate).
- Audit exported symbols (entrypoints `src/index.ts`, `src/get-dotenv/index.ts`) and ensure every exported symbol has a clear, concise, complete TypeDoc comment (even if TypeDoc emits 0 warnings).
- Re-run `npm run build` and verify Rollup outputs align with `package.json` exports (`dist/mjs/index.js`, `dist/mjs/get-dotenv/index.js`, and CJS equivalents).
- Re-run `npm run lint`, `npm run typecheck`, and `npm run docs` and confirm all pass with 0 TypeDoc warnings (expect 0).
- If `src/EntityClient/EntityClient.ts` is still >300 LOC, continue decomposition (keep API inference intact; prefer small helpers/modules).

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
- Aligned README and guides with current implementation details (aws/dynamodb config namespace, create latest-only guard, managed table properties invariants, version token semantics, projection wording).
- Continued doc pass: de-duplicated README CLI plugin section, restored License section, and normalized stray CR characters in touched guides for reliable copy/paste.
- Performed TypeDoc pass for exported API: filled missing property docs, added type params/params/returns where needed, and ensured exported types are not hidden via `@protected`.
- Fixed remaining tsdoc warnings by extracting `CreateQueryBuilderOptions`, escaping `-\>` in `IndexParams`, and correcting the `generateTableDefinition` example.
- Fixed TypeDoc missing-symbol warnings by exporting get-dotenv tableProperties and completed EntityClient/migrate decomposition work to keep long modules variance-friendly.
- Fixed getItem/getItems option narrowing to satisfy TS/ESLint after readonly projection support.
- Fixed readonly array narrowing for BatchGetOptions vs projections (unblocks tsc/typedoc).
- Exported EntityClient GetItemOutput/GetItemsOutput so TypeDoc can include referenced return types (0 warnings goal).
- Enabled TypeDoc `validation.notDocumented` to enforce complete API docs.
- Added missing TypeDoc comments and named result types to clear notDocumented warnings across exported surfaces.
- Fixed docs script warnings by removing schema exports, documenting resolver return properties, and re-exporting referenced result types for TypeDoc inclusion.
- Removed remaining TypeDoc config-schema reference warnings by decoupling `DynamodbPluginConfig` from the internal Zod schema symbol.
- Split root vs /get-dotenv packaging outputs: add a real get-dotenv entrypoint build and map its export types to dist/get-dotenv/index.d.ts.
- Fixed rollup build by externalizing dependency subpath imports (e.g. `@karmaniverous/get-dotenv/cliHost`) so transitive deps like `npm-run-path` are not bundled.
- Added a compact STAN-assistant guide for using the base library and the get-dotenv DynamoDB plugin (entrypoints, typing model, lifecycle/migration semantics, and common pitfalls).
- Fixed Rollup preserveModules output paths (set preserveModulesRoot) so built files match exports (`dist/mjs/index.js`), resolving SMOZ interop missing-module errors.