# Development plan

## Next up (priority order)

None.

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