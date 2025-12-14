---
title: Diagnostics & Errors
---

# Authoring Plugins: Diagnostics & Errors

This page summarizes common diagnostics and error‑handling patterns for plugin authors. The goal is predictable behavior in CI and a consistent experience with the shipped plugins.

## Errors: fail by default

Throw on subprocess failures by default. Only continue on error when the option is explicit (e.g., batch’s `--ignore-errors`), and document the behavior clearly.

## Capture and CI‑friendly output

Honor the global capture contract:

- If `process.env.GETDOTENV_STDIO === 'pipe'` or the merged options bag has `capture: true`, run your subprocess with `stdio: 'pipe'` and re‑emit buffered outputs after completion.
- Otherwise, inherit stdio for live interaction.

```ts
import { readMergedOptions } from '@karmaniverous/get-dotenv/cliHost';
import { execa } from 'execa';

const bag = readMergedOptions(thisCommand) ?? {};
const capture =
  process.env.GETDOTENV_STDIO === 'pipe' ||
  (bag as { capture?: boolean }).capture;
const { exitCode } = await execa(file, args, {
  stdio: capture ? 'pipe' : 'inherit',
});
```

## Optional trace / redaction / entropy (best practice)

When your plugin launches a subprocess, you can emit a short diagnostic prelude similar to the cmd plugin’s `--trace`:

- For each key in `{ ...process.env, ...ctx.dotenv }` (or a selected subset), print the origin (dotenv | parent | unset).
- Apply presentation‑time redaction for secret‑like keys (user‑enabled).
- Optionally warn once per key about high‑entropy values (presentation‑only).

This format is a best practice, not a requirement. Reuse when parity with the cmd plugin is desirable.

## Normalized child environment

Always use `buildSpawnEnv(process.env, ctx.dotenv)` to compose and normalize the child environment before passing it to your subprocess. This avoids platform‑specific surprises:

- On Windows, dedupe keys case‑insensitively and ensure HOME/TMP/TEMP are coherent.
- On POSIX, populate TMPDIR if a temp key is present.

```ts
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
const env = buildSpawnEnv(process.env, ctx.dotenv);
```

## Logging guidance

Prefer concise, single‑line status headers per run. Avoid verbose per‑line prefixes unless you introduce a dedicated `--verbose` or `--debug`.

See also:

- [Executing Shell Commands](./exec.md)
- [Shell Execution Behavior](../shell.md)
