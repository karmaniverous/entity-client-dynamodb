---
title: Authoring Plugins
children:
  - ./lifecycle.md
  - ./config.md
  - ./diagnostics.md
  - ./exec.md
---

## Authoring Plugins

This section introduces the plugin‑first host and groups plugin documentation by topic. The host resolves dotenv context once per invocation, overlays config (JSON/YAML/JS/TS), validates, and then runs plugins and subcommands under that context.

- [Lifecycle & Wiring](./lifecycle.md) - Covers defining and wiring plugins against the host.
- [Config & Validation](./config.md) - Explains config overlays, interpolation timing, and validation.
- [Diagnostics & Errors](./diagnostics.md) - Covers error handling, capture, and optional trace/redaction.
- [Executing Shell Commands](./exec.md) - A focused deep dive for subprocesses across plugins.
