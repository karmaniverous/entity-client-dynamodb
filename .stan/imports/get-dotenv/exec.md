---
title: Executing Shell Commands
---

# Authoring Plugins: Executing Shell Commands

For an overview of default shells and quoting across platforms, see [Shell execution behavior](../shell.md). The host normalizes `--shell` defaults to `/bin/bash` on POSIX and `powershell.exe` on Windows unless explicitly overridden, and CLI‑driven plugins should usually honor the root shell (with rare per‑script overrides).

There are two distinct patterns for plugins that run shell commands:

1. CLI‑driven (cmd/batch‑like): the user types arbitrary commands; a scripts table helps encapsulate frequently used commands.
2. Tool‑invocation inside a plugin: the plugin calls an external tool (e.g., docker) with env/config‑derived overrides; scripts are typically not relevant.

This guide explains expansion timing (including dotenv‑style expansion of CLI flag values and config slices), shell selection, child environment composition, capture/diagnostics, quoting, and safety, with minimal patterns you can copy.

## Where expansion happens

- Config‑derived strings (including plugin config and global scripts) are interpolated by the host before your plugin runs. Interpolation uses dotenv syntax against `{ ...ctx.dotenv, ...process.env }` (process.env wins), so these values arrive pre‑expanded once. Treat them as final; avoid re‑expanding to prevent surprises.
- Runtime inputs (argv/flags you parse): you choose. If you want pre‑expansion, call a dotenv expander once (e.g., `dotenvExpandFromProcessEnv`); otherwise rely on the shell to expand. Document the behavior so users understand quoting implications.
- Built‑in parity note:
  - The parent‑level alias (`--cmd 'node -e "…"'`) expands the alias value once before execution.
  - The `cmd` subcommand’s positional tokens are not pre‑expanded; the shell (or lack of shell) governs expansion.

### Expanding environment references in plugin flag values

Downstream users of third‑party plugins often want to reference values from the current dotenv context inside command-line option values, for example: `getdotenv aws dynamodb migrate --table-name '${TABLE_NAME}'`.

Important: the host does not automatically dotenv-expand arbitrary plugin flag values. This differs from config-derived strings (which the host interpolates before your plugin runs using `dotenvExpandAll`/`interpolateDeep`) and from selected root flags which explicitly install an `argParser` (see [`src/cliHost/attachRootOptions.ts`](../../src/cliHost/attachRootOptions.ts)).

If you want this UX, you must expand the option value yourself, and you should document the quoting rules so users don’t accidentally expand in the outer shell before your plugin sees the raw `$VAR`/`${VAR}` expression.

Recommended strategies:

- Action-time expansion (ctx-aware; recommended): expand using `{ ...process.env, ...ctx.dotenv }` so the resolved dotenv context takes precedence, and so the behavior does not depend on `loadProcess` being enabled.
- Parse-time expansion (process-only; niche): use `.argParser(dotenvExpandFromProcessEnv)` only when you explicitly want to expand against the parent process environment. This is the pattern used by the shipped cmd plugin alias expansion in [`src/plugins/cmd/parentInvoker.ts`](../../src/plugins/cmd/parentInvoker.ts), and it’s appropriate for “expand with whatever the current process already has” semantics.

#### Action-time expansion (ctx-aware; recommended)

This is the most reliable approach for plugins, because it expands against the resolved get-dotenv context even when `loadProcess` is OFF (which is common for safety).

```ts
import { dotenvExpand } from '@karmaniverous/get-dotenv';
import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';

export const dynamodbMigratePlugin = () =>
  definePlugin({
    ns: 'migrate',
    setup(cli) {
      cli
        .requiredOption(
          '--table-name <string>',
          'DynamoDB table name (dotenv-expanded against ctx.dotenv)',
        )
        .action((_args, opts) => {
          const ctx = cli.getCtx();
          const raw = String((opts as { tableName?: unknown }).tableName ?? '');

          // Prefer ctx-aware expansion: ctx.dotenv overrides parent process.env.
          const expanded =
            dotenvExpand(raw, { ...process.env, ...ctx.dotenv }) ?? raw;

          if (!expanded) {
            throw new Error(
              'Missing --table-name (or it expanded to an empty string). ' +
                "If you intended to reference an env var, pass it as '${NAME}' and ensure NAME exists in the resolved dotenv context.",
            );
          }

          // Use expanded value (do not re-expand config-derived strings here)
          console.log(`migrating table=${expanded}`);
        });
    },
  });
```

Notes:

- `dotenvExpand` is implemented in [`src/dotenv/dotenvExpand.ts`](../../src/dotenv/dotenvExpand.ts).
- `dotenvExpand('$MISSING')` returns `undefined` (isolated missing var), while embedded missing vars usually collapse to `''` inside a larger string. Decide whether your plugin should treat “missing” as an error (recommended for required flags) or as a best-effort expansion.
- If you want a default/fallback value, document the supported syntax to your users: `${NAME:default}` (or `$NAME:default`).

#### Using dotenvExpand as an option parser (when it is and isn’t appropriate)

Commander lets you attach a parser to an option:

```ts
cli.option(
  '--name <string>',
  'example',
  (value: string) => value.trim(), // parser
);
```

You can wire a dotenv expander there, but it is important to understand **what env it runs against and when**:

- Parsers run at **parse time**, before the host resolves the dotenv context or calls `resolveAndLoad`.
- The default `dotenvExpand(value)` uses **`process.env` only**, not `{ ...process.env, ...ctx.dotenv }`.

This means:

- `cli.option('--table-name <string>', '...', dotenvExpand)` expands against the parent process env, not the resolved get‑dotenv context.
- You cannot make a parser see `ctx.dotenv`, because `ctx` does not exist yet while Commander is parsing argv.

This behavior is sometimes exactly what you want, but only in **niche, process‑only cases**.

Recommended guidelines:

- For **root‑level, process‑only flags** (like the shipped cmd parent alias), it is fine to use `dotenvExpandFromProcessEnv` in a parser:

  ```ts
  import { dotenvExpandFromProcessEnv } from '@karmaniverous/get-dotenv';

  parentCmd
    .option(
      '--cmd <command...>',
      'alias of cmd subcommand (dotenv-expanded against process.env)',
    )
    .argParser(dotenvExpandFromProcessEnv);
  ```

  This clearly states the semantics: “expand with whatever is in `process.env` right now,” and matches the shipped behavior.

- For **plugin options that should see the resolved dotenv context**, **do not** use `dotenvExpand` as a parser. Instead, expand at action time against `{ ...process.env, ...ctx.dotenv }` as shown earlier:

  ```ts
  cli
    .ns('migrate')
    .requiredOption('--table-name <string>', 'DynamoDB table name')
    .action((_args, opts) => {
      const ctx = cli.getCtx();
      const raw = String((opts as { tableName?: unknown }).tableName ?? '');
      const envRef = { ...process.env, ...ctx.dotenv };
      const expanded = dotenvExpand(raw, envRef) ?? raw;
      // ...
    });
  ```

  This keeps behavior independent of `loadProcess` and ensures plugin flags see the same composed env your subprocess will receive.

In short:

- **Parse‑time expansion** with `.argParser(dotenvExpandFromProcessEnv)` is appropriate only when you intentionally want “process‑only” semantics and you document that clearly.
- **Action‑time expansion** with `dotenvExpand(value, { ...process.env, ...ctx.dotenv })` is the right choice for most plugins, because it is ctx‑aware and runs after the host has built the final dotenv context.

##### Small reusable helper (docs pattern)

If you have multiple options that should support `${NAME}`-style expansion, consider a tiny helper for your plugin:

```ts
import { dotenvExpand } from '@karmaniverous/get-dotenv';
import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';
import type { ProcessEnv } from '@karmaniverous/get-dotenv';

type ExpandMode = 'strict' | 'best-effort';

function expandFlagValue(
  cli: GetDotenvCliPublic,
  raw: unknown,
  mode: ExpandMode,
): string {
  const value = String(raw ?? '');
  if (!value) {
    if (mode === 'strict') {
      throw new Error('Required flag value is empty.');
    }
    return value;
  }

  const ctx = cli.getCtx();
  const envRef: ProcessEnv = { ...process.env, ...ctx.dotenv };
  const expanded = dotenvExpand(value, envRef);

  if (expanded === undefined) {
    if (mode === 'strict') {
      throw new Error(
        `Flag value ${JSON.stringify(value)} could not be expanded: ` +
          'referenced an unset variable with no default. ' +
          "Use '${NAME:default}' to supply a fallback, or ensure NAME exists " +
          'in the resolved dotenv context.',
      );
    }
    // best-effort: keep original when fully-unresolved
    return value;
  }

  if (!expanded && mode === 'strict') {
    throw new Error(
      `Flag value ${JSON.stringify(value)} expanded to an empty string.`,
    );
  }

  return expanded;
}
```

Usage inside a plugin action:

```ts
cli
  .ns('migrate')
  .requiredOption('--table-name <string>', 'DynamoDB table name')
  .option('--schema <string>', 'optional schema name')
  .action((_args, opts) => {
    const tableName = expandFlagValue(cli, (opts as any).tableName, 'strict');
    const schema = expandFlagValue(cli, (opts as any).schema, 'best-effort');

    console.log({ tableName, schema });
  });
```

Notes:

- This pattern is docs-only; it is not shipped as a helper today, but you can copy/paste and adapt it inside your plugin package.
- `strict` vs `best-effort` is per-call, so you can require certain flags to expand cleanly while letting others be more forgiving.

##### Arrays and deep structures: `dotenvExpandAll` + `interpolateDeep`

For simple scalars, `dotenvExpand` is enough. For more complex data:

- Use `dotenvExpandAll` when you have a flat `Record<string, string | undefined>`, e.g., a small env-like map.
- Use `interpolateDeep` when you have nested objects (e.g., plugin config slices) and want to expand only string leaves while preserving non-strings and arrays.

Both are exported from the public API:

```ts
import {
  dotenvExpandAll,
  interpolateDeep,
  type ProcessEnv,
} from '@karmaniverous/get-dotenv';

const envRef: ProcessEnv = { ...process.env, ...ctx.dotenv };

const flat = dotenvExpandAll(
  { TABLE: '${TABLE_NAME}', STAGE: '$STAGE:dev' },
  {
    ref: envRef,
    progressive: true,
  },
);

const deep = interpolateDeep(
  { migrations: [{ table: '${TABLE_NAME}', region: '$AWS_REGION' }] },
  envRef,
);
```

#### CLI usage examples and quoting (portable)

Preferred (portable across shells): quote the expression so the _outer shell_ does not expand it before your plugin sees it.

```bash
# Expand from the resolved get-dotenv context inside the plugin
getdotenv aws dynamodb migrate --table-name '${TABLE_NAME}'

# Provide a fallback/default at the call site
getdotenv aws dynamodb migrate --table-name '${TABLE_NAME:my-table}'
```

Alternative (outer shell expansion): let the outer shell expand first, and pass the fully expanded value to the plugin. This is less portable, but sometimes convenient.

```bash
# POSIX shells (bash/zsh): $TABLE_NAME is expanded by the shell
getdotenv aws dynamodb migrate --table-name "$TABLE_NAME"

# PowerShell: use $env:TABLE_NAME for environment variables
getdotenv aws dynamodb migrate --table-name "$env:TABLE_NAME"
```

If you choose to rely on outer shell expansion, document the shell-specific syntax and quoting differences explicitly; otherwise, prefer the portable dotenv-style `${NAME}` syntax and expand inside the plugin action.

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

### Preserve Node `-e/--eval` argv under shell‑off

When executing a plain `node -e` snippet without a shell, preserve the argv array so code payloads remain intact across platforms (especially Windows/PowerShell). The host exports a small helper for this:

```ts
import { maybePreserveNodeEvalArgv } from '@karmaniverous/get-dotenv/cliHost';

// args = ['node', '-e', 'console.log("ok")', ...]
const argv = maybePreserveNodeEvalArgv(args);
// pass argv directly to execa(...)
```

## Double‑expansion and safety

- Config strings are already interpolated once by the host. Do not re‑expand them in your plugin. If you need a late expansion step, do it exactly once and document it.
- Prefer env injection over in‑line secrets in command text to avoid leaking secrets via logs or process lists.

## Minimal patterns

### Tool‑invocation (no scripts)

```ts
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
import { definePlugin, readMergedOptions, runCommand, shouldCapture } from '@karmaniverous/get-dotenv/cliHost';

export const dockerPlugin = () =>
  definePlugin({
    ns: 'docker',
    setup(cli) {
      cli
        .argument('[args...]')
        .action(async (args, _opts, thisCommand) => {
          const bag = readMergedOptions(thisCommand);
          const ctx = cli.getCtx();
          const env = buildSpawnEnv(process.env, ctx.dotenv);

          // Choose shell behavior: explicit false (plain), or inherit the normalized root shell
          const shell = bag.shell ?? false;
          const capture = shouldCapture(bag.capture);

          // Shell-off: prefer argv arrays to preserve payloads
          const argv = [
            'docker',
            ...(Array.isArray(args) ? args.map(String) : []),
          ];
          await runCommand(argv, shell === false ? false : shell, {
            env,
            stdio: capture ? 'pipe' : 'inherit',
          });
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
import { buildSpawnEnv } from '@karmaniverous/get-dotenv';
import {
  definePlugin,
  maybePreserveNodeEvalArgv,
  readMergedOptions,
  resolveCommand,
  resolveShell,
  runCommand,
  shouldCapture,
  type ScriptsTable,
} from '@karmaniverous/get-dotenv/cliHost';

export const runPlugin = () => {
  const plugin = definePlugin({
    ns: 'run',
    setup(cli) {
      cli
        .argument('[command...]')
        .action(async (commandParts, _opts, thisCommand) => {
          const bag = readMergedOptions(thisCommand);
          const ctx = cli.getCtx();
          const env = buildSpawnEnv(process.env, ctx.dotenv);

          const input = Array.isArray(commandParts)
            ? commandParts.map(String).join(' ')
            : '';
          if (!input) {
            console.log('Provide a script name or a raw command');
            return;
          }
          // Prefer plugin-scoped scripts first (rare), then optionally fall back to root scripts
          const { scripts: pluginScripts } = plugin.readConfig<{
            scripts?: ScriptsTable;
          }>(cli);
          const rootScripts = bag.scripts;
          const scripts = pluginScripts ?? rootScripts;
          const resolvedCmd = resolveCommand(scripts, input);

          // Precedence: per-script shell (object form) > root shell
          const shell = resolveShell(scripts, input, bag.shell);
          const capture = shouldCapture(bag.capture);

          // Preserve argv only when shell-off and the command wasn't remapped by scripts.
          const argvIn = Array.isArray(commandParts) ? commandParts.map(String) : [];
          const commandArg =
            shell === false && resolvedCmd === input
              ? maybePreserveNodeEvalArgv(argvIn)
              : resolvedCmd;

          await runCommand(commandArg, shell, {
            env,
            stdio: capture ? 'pipe' : 'inherit',
          });
        });
    },
  });
  return plugin;
};
```

Notes:

- Commands typed at the CLI may be a script name or a raw command.
- Prefer plugin‑scoped `plugins.<mount-path>.scripts` for clarity; fall back to root scripts when it’s helpful.
- Rarely, the object form `{ cmd, shell }` lets a single script request a different shell; otherwise the root shell applies.

See also:

- [Shell Execution Behavior](../shell.md)
- [Diagnostics](./diagnostics.md)

## TypeScript notes

- A helper `defineScripts<TShell>()(table)` is available when you want to preserve concrete shell types through your scripts table (useful for rare per‑script overrides).
- Env overlay/expansion utilities accept readonly record inputs, so you can pass `as const` objects where it improves inference without extra casts.
