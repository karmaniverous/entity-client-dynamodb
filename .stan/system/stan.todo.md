# Development plan

## Next up (priority order)

- DynamoDB get-dotenv plugin: aws-pattern typed Commander (hard gate)
  - Implement `.stan/system/stan.requirements.dynamodb-plugin.cli-typing.md` across `src/get-dotenv/cli/plugin/**`:
    - Fix action callback arity everywhere (options-only commands use `(opts, thisCommand)`).
    - Replace `Record<string, unknown>` flags with Commander-inferred `opts` types (no casts at call sites).
    - Reject invalid numerics at parse time using `InvalidArgumentError` parsers (maxSeconds, port, pageSize, limit, transformConcurrency, progressIntervalMs, RCU/WCU, etc).
    - Remove `cli.getCtx()?.dotenv` optional chaining; ctx is required at action time.
  - Introduce a shared, typed plugin instance seam (aws-pattern):
    - Add a single exported alias (e.g., `DynamodbPluginInstance`) which threads `DynamodbPluginConfig` into `PluginWithInstanceHelpers`, and use it in every `register*` signature.
    - Eliminate brittle `PluginReader` intersection typing that can collapse to `unknown`.
  - Add dynamic option descriptions only where defaults are config-derived (schema defaults / config values):
    - Use `plugin.createPluginDynamicOption` for `tablesPath`, `tokens.*`, and `local.*` defaults when present in validated config.
    - Do not claim defaults for env-derived values (e.g., `TABLE_NAME`, derived endpoints).

- DynamoDB get-dotenv plugin: fixtures-first tests (Commander + host)
  - Replace FakeGroup wiring tests with integration-style tests that run real Commander dispatch through the get-dotenv host:
    - Construct a real host (e.g., `createCli` / `GetDotenvCli`) and mount `dynamodbPlugin()`.
    - Execute with argv and assert: resolved service calls, console output, and `process.exitCode` behavior.
    - Mock only leaf seams (services/local, services/create/delete/generate/migrate/validate, emLoader).
  - Avoid partial mocks of `@karmaniverous/get-dotenv/cliHost`; if mocking is unavoidable, spread `vi.importActual` and override only specific exports.
  - Add a lightweight parent fixture plugin when we need to validate realized mount path behavior (e.g., simulating `aws/dynamodb`) without running the real aws plugin.

- Cleanup after typed CLI + fixtures land
  - Re-run and fix: `npm run typecheck`, `npm run lint`, `npm run test`.
  - Address remaining lint failures that are not resolved by typing:
    - Fix `@typescript-eslint/restrict-template-expressions` in `src/get-dotenv/services/local.ts` (stringify numeric template parts).
  - Ensure no command uses `process.exit()`; use `process.exitCode` for CI-friendly signaling.

- Reduce reliance on imported upstream docs (next thread goal)
  - After the above lands (and the requirements docs fully capture patterns), remove `.stan/imports/**` for commander typings and aws plugin source from the working set and rely on in-repo requirements docs instead.

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

- Requirements: codify aws-pattern Commander typing and fixtures-first tests for dynamodb plugin (embed key semantics so imported docs can be dropped next thread).

- DynamoDB plugin CLI typing groundwork
  - Added shared strict numeric parsers for Commander options.
  - Fixed local command action arity and improved local wiring test mocks to preserve real cliHost exports.
  - Skipped Docker-backed EntityClient integration suite when Docker is unavailable.

- Typecheck: fix missing Command import in local wiring test.

- Tests: migrate local wiring test to createCli (fixtures-first).

- Tests: fix createCli argv shape (node/script prefix) in local wiring test.

- Tests: local wiring now uses GetDotenvCli+resolveAndLoad for ctx/bag.

- Tests: ensure GetDotenvCli.install() runs before parse in local wiring.