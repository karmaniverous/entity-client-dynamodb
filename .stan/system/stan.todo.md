# Development plan

## Next up (priority order)

- Implement version handling overhaul:
  - Add config key `minTableVersionWidth` (default 3).
  - Discover version dirs by `^\d+$`, order by numeric value, and error on duplicate numeric values (e.g., `1` and `001`).
  - Require explicit version values after interpolation (no implicit default-to-latest) for versioned commands.
  - Enforce `migrate`: both `fromVersion` and `toVersion` must exist as version dirs.
- Implement managed table properties:
  - Rename `generate.overlays` to `generate.tableProperties`.
  - Rename generate CLI flags to `--table-*` (billing mode / rcu / wcu / table name).
  - Apply managed table properties deterministically on generate/refresh; preserve all other non-generated keys.
  - Add validations: PROVISIONED requires ProvisionedThroughput; throughput management requires explicit BillingMode=PROVISIONED.
- Implement `generate` UX fixes:
  - Remove `generate --force`.
  - Add `generate --clean` (recompose from baseline + generated + managed props).
- Implement `create` safety gate:
  - Reject non-latest version creates by default in all environments; allow override via `--allow-non-latest`.
  - Ensure `create --refresh-generated` refreshes generated sections and applies managed table properties.
- Make validation order-insensitive (DynamoDB-aware canonicalization) and include managed table properties drift when configured.
- Update CLI docs to assume `aws dynamodb ...` and `plugins["aws/dynamodb"]` and to reflect new `generate`/managed properties semantics.

## Completed

**CRITICAL: Append-only list. Add new completed items at the end. Prune old completed entries from the top. Do not edit existing entries.**
- Updated requirements to unify DynamoDB CLI semantics: numeric version ordering with `minTableVersionWidth`, managed table properties (`generate.tableProperties` + `--table-*` flags), `generate --clean` (no `--force`), `create` latest-only guard with `--allow-non-latest`, and order-insensitive drift validation including managed properties.