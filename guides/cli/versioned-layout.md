---
title: Versioned Layout & Tokens
---

# Versioned Layout & Tokens

Opinionated structure under a configurable root (default: `tables`):

```
tables/
  table.template.yml     # optional baseline for non-generated Properties
  001/
    entityManager.ts     # EM for this version (or fallback to earlier)
    table.yml            # full AWS::DynamoDB::Table resource
    transform.ts         # optional per-step transforms
  002/
    ...
```

Tokens (configurable)

- `table` (table.yml)
- `entityManager` (entityManager.ts/.js)
- `transform` (transform.ts/.js)

Fallback EntityManager resolution

- For each step, resolve both prev and next EM: try the version directory first; if missing, walk backward to the nearest version with entityManager present.
- Required for the default chain (prev.removeKeys → next.addKeys).

Notes

- Version directories are digit-only (for example `001/` or `1/`); ordering is by numeric value, and duplicates by numeric value (for example `1/` and `001/`) are rejected.
- `minTableVersionWidth` controls how tooling formats version tokens when it needs to emit a canonical token; it does not restrict existing directory tokens.
- File resolution supports `.ts` and `.js` for EM/transform modules, but in plain Node.js runtime you should prefer `.js` unless your host supports TS execution (for example via tsx/ts-node) or you precompile the modules.

Related

- [Table lifecycle](./table-lifecycle.md)
- [Authoring transforms](./authoring-transforms.md)
