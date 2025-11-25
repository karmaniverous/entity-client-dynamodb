# Development plan

## Next up (priority order)

- Local DynamoDB orchestration (Option B; no separate "ready"):
  - Tests:
    - Wiring tests for commands/local (mock library, assert execa/execaCommand/env/shell/capture usage)
    - Unit tests for services/local (endpoint derivation, probe logic, retry)
  - Docs:
    - Update typedoc guides/CLI docs to include the new local commands and behavior (no ready command; readiness integrated into start).

## Completed

**CRITICAL: Append-only list. Add new completed items at the end. Prune old completed entries from the top. Do not edit existing entries.**
- Docs: compact README + TypeDoc guides (core & CLI Plugin section with index)
  - Replaced long README with landing page and bulleted index.
  - Added targeted guides under docs/guides and docs/guides/cli with children front matter on CLI index.
  - Updated typedoc.json projectDocuments to include all guides. - Local DynamoDB orchestration — code foundations
   - Types/config: added DynamodbPluginConfig.local without “ready”.
   - Services: services/local.ts with deriveEndpoint, config-command exec (execaCommand), health probes (library preferred, SDK fallback), and start/stop/status orchestrators using buildSpawnEnv and capture/stdio precedence.
   - CLI wiring: commands/local.ts registering “dynamodb local start|stop|status”; integrated into plugin index; start blocks until healthy and prints endpoint + export hint; status returns 0 when healthy.