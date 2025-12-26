---
title: Table Lifecycle
---

# Table Lifecycle

Commands (when mounted under `aws`: `aws dynamodb ...`)

- `generate` – compose or refresh `tables/NNN/table.yml` (comment-preserving)
- `validate` – compare generated sections against the resolved EM
- `create` – create table from YAML (validate or refresh generated sections)
- `delete` – delete table (waiter)
- `purge` – scan and delete all items

Generate (from root baseline if present)

```bash
mycli aws dynamodb generate --version 001
```

Regenerate from baseline (`--clean`)

```bash
mycli aws dynamodb generate --version 001 --clean
```

Managed table properties (optional)

When you want tooling to deterministically manage selected non-generated `Properties` keys in `table.yml`, pass `--table-*` flags (or configure `plugins["aws/dynamodb"].generate.tableProperties`).

Invariants enforced by the implementation: Provisioned throughput management requires `--table-billing-mode PROVISIONED` and both `--table-rcu` and `--table-wcu` together; `PAY_PER_REQUEST` is incompatible with `ProvisionedThroughput` in `table.yml`.

```bash
mycli aws dynamodb generate --version 001 \
  --table-name '$DDB_TABLE' \
  --table-billing-mode PROVISIONED \
  --table-rcu 5 \
  --table-wcu 5
```

Validate drift

```bash
mycli aws dynamodb validate --version 001
```

Create (validate by default)

```bash
mycli aws dynamodb create --version 001 --max-seconds 60
```

Create latest-only guard (default behavior)

- By default, `create` refuses to create a non-latest version directory (unsafe). Use `--allow-non-latest` to override explicitly.

Create with refresh and TableName override

```bash
mycli aws dynamodb create --version 001 \
  --refresh-generated \
  --table-name-override MyTable \
  --max-seconds 120
```

Delete and purge (confirmation required; CI use `--force`)

```bash
mycli aws dynamodb delete --table-name MyTable --version 001 --max-seconds 30 --force
mycli aws dynamodb purge  --table-name MyTable --version 001 --force
```

Notes

- For `create`, `--force` only affects drift handling when `--validate` is enabled (it is not a confirmation flag).

Comment-preserving YAML

- Only the generated Properties keys are overwritten:
  - AttributeDefinitions
  - KeySchema
  - GlobalSecondaryIndexes
- All other Properties and comments are preserved.

Related

- [Versioned layout and tokens](./versioned-layout.md)
- [Data migration](./migrate.md)
