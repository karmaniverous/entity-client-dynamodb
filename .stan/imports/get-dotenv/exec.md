---
title: Executing Shell Commands
---

# Authoring Plugins: Executing Shell Commands

There are two distinct patterns for plugins that run shell commands:

1. CLI‑driven (cmd/batch‑like): the user types arbitrary commands; a scripts table helps encapsulate frequently used commands.
2. Tool‑invocation inside a plugin: the plugin calls an external tool (e.g., docker) with env/config‑derived overrides; scripts are typically not relevant.

This guide explains expansion timing, shell selection, child environment composition, capture/diagnostics, quoting, and safety, with minimal patterns you can copy.

## Where expansion happens

- Config‑derived strings (including plugin config and global scripts) are interpolated by the host before your plugin runs. Interpolation uses dotenv syntax against `{ ...ctx.dotenv, ...process.env }` (process.env wins), so these values arrive pre‑expanded once. Treat them as final; avoid re‑expanding to prevent surprises.
- Runtime inputs (argv/flags you parse): you choose. If you want pre‑expansion, call a dotenv expander once (e.g., `dotenvExpandFromProcessEnv`); otherwise rely on the shell to expand. Document the behavior so users understand quoting implications.
- Built‑in parity note:
  - The parent‑level alias (`--cmd 'node -e "…"'`) expands the alias value once before execution.
  - The `cmd` subcommand’s positional tokens are not pre‑expanded; the shell (or lack of shell) governs expansion.

## Shell selection and precedence

Plugins should rely on the root shell setting unless a command itself requests a different shell:

- Root `--shell` (global) is normalized by the host to a concrete default when enabled:
  - POSIX: `/bin/bash`
  - Windows: `powershell.exe`
- Rare per‑script override: if you offer a scripts table and use the object form `{ cmd, shell }`, prefer `scripts[name].shell` over the root shell for that script only. This is appropriate for CLI‑driven, arbitrary‑command plugins (cmd/batch‑like). It is uncommon elsewhere.
- Discouraged: a per‑plugin `shell` option. Use the root shell and the rare per‑script override instead.

Recommended precedence (when you support scripts):

```
scripts[name].shell (object form) > root bag.shell
```

## Child environment composition (required)

Always inject a normalized env into child processes:

```ts
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
const childEnv = buildSpawnEnv(process.env, ctx.dotenv);
```

Benefits:

- Windows: dedupes case‑insensitive keys, fills HOME from USERPROFILE, normalizes TMP/TEMP.
- POSIX: populates TMPDIR when a temp key is present.

## Capture and diagnostics

Honor the shared capture contract for CI‑friendly logs:

- Use `stdio: 'pipe'` when `process.env.GETDOTENV_STDIO === 'pipe'` or the merged root options bag sets `capture: true`. Otherwise, inherit stdio for live interaction.
- Optional, best practice: mirror the cmd plugin’s concise `--trace [keys...]` lines (origin: dotenv | parent | unset) with presentation‑time redaction for secret‑like keys and once‑per‑key entropy warnings. This is not a requirement but provides a consistent DX.

## Quoting and argv vs string

- Shell‑off (plain exec): prefer argv arrays (especially for `node -e "…"`) to avoid lossy re‑tokenization and keep code payloads intact.
- Shell‑on: pass a single string to the selected shell and document quoting rules:
  - POSIX and PowerShell both treat single quotes as literal and double quotes as interpolating. Recommend single quotes when users want to prevent outer‑shell expansion.

## Double‑expansion and safety

- Config strings are already interpolated once by the host. Do not re‑expand them in your plugin. If you need a late expansion step, do it exactly once and document it.
- Prefer env injection over in‑line secrets in command text to avoid leaking secrets via logs or process lists.

## Minimal patterns

### Tool‑invocation (no scripts)

```ts
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import { readMergedOptions } from '@karmaniverous/get-dotenv/cliHost';
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';
import { execa } from 'execa';

export const dockerPlugin = () =>
  definePlugin({
    id: 'docker',
    setup(cli: GetDotenvCliPublic) {
      cli
        .ns('docker')
        .argument('[args...]')
        .action(async (args, _opts, thisCommand) => {
          const bag = readMergedOptions(thisCommand) ?? {};
          const ctx = cli.getCtx();
          const env = buildSpawnEnv(process.env, ctx?.dotenv ?? {});

          // Choose shell behavior: explicit false (plain), or inherit the normalized root shell
          const shell = (bag as { shell?: string | boolean }).shell ?? false;
          const capture =
            process.env.GETDOTENV_STDIO === 'pipe' ||
            (bag as { capture?: boolean }).capture;

          // Shell-off: prefer argv arrays to preserve payloads
          const argv = [
            'docker',
            ...(Array.isArray(args) ? args.map(String) : []),
          ];
          const file = argv[0]!;
          const fileArgs = argv.slice(1);

          const child = await execa(file, fileArgs, {
            env,
            stdio: capture ? 'pipe' : 'inherit',
            ...(shell !== false ? { shell } : {}),
          });
          if (capture && child.stdout)
            process.stdout.write(
              child.stdout + (child.stdout.endsWith('\n') ? '' : '\n'),
            );
        });
    },
  });
```

Notes:

- Use `shell: false` for simpler, safer argv flows; flip to the root shell only when you need shell parsing.
- Build `env` with `buildSpawnEnv`.
- Honor capture for CI determinism.

### CLI‑driven (scripts optional, rare per‑script override)

```ts
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import { readMergedOptions } from '@karmaniverous/get-dotenv/cliHost';
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';
import { execaCommand } from 'execa';

type Script = string | { cmd: string; shell?: string | boolean };
type Scripts = Record<string, Script>;

function resolveScript(
  scripts: Scripts | undefined,
  nameOrCmd: string,
): { cmd: string; shell?: string | boolean } {
  const entry = scripts?.[nameOrCmd];
  if (!entry) return { cmd: nameOrCmd };
  return typeof entry === 'string' ? { cmd: entry } : entry;
}

export const runPlugin = () =>
  definePlugin({
    id: 'run',
    setup(cli: GetDotenvCliPublic) {
      cli
        .ns('run')
        .argument('[command...]')
        .action(async (commandParts, _opts, thisCommand) => {
          const bag = readMergedOptions(thisCommand) ?? {};
          const ctx = cli.getCtx();
          const env = buildSpawnEnv(process.env, ctx?.dotenv ?? {});

          const input = Array.isArray(commandParts)
            ? commandParts.map(String).join(' ')
            : '';
          if (!input) {
            console.log('Provide a script name or a raw command');
            return;
          }
          // Prefer plugin-scoped scripts first (rare), then optionally fall back to root scripts
          const pluginScripts =
            (ctx?.pluginConfigs?.['run'] as { scripts?: Scripts })?.scripts ??
            undefined;
          const rootScripts =
            (bag as { scripts?: Scripts }).scripts ?? undefined;
          const chosen = resolveScript(pluginScripts ?? rootScripts, input);

          // Precedence: per-script shell (object form) > root shell
          const rootShell = (bag as { shell?: string | boolean }).shell;
          const shell = chosen.shell !== undefined ? chosen.shell : rootShell;
          const capture =
            process.env.GETDOTENV_STDIO === 'pipe' ||
            (bag as { capture?: boolean }).capture;

          await execaCommand(chosen.cmd, {
            env,
            stdio: capture ? 'pipe' : 'inherit',
            ...(shell !== undefined ? { shell } : {}),
          });
        });
    },
  });
```

Notes:

- Commands typed at the CLI may be a script name or a raw command.
- Prefer plugin‑scoped `plugins.run.scripts` for clarity; fall back to root scripts when it’s helpful.
- Rarely, the object form `{ cmd, shell }` lets a single script request a different shell; otherwise the root shell applies.

See also:

- [Shell Execution Behavior](../shell.md)
- [Diagnostics](./diagnostics.md)
