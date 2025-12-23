# DynamoDB get-dotenv plugin — CLI typing and aws-pattern reference (authoritative)

Purpose

- This document captures the Commander typing model and the shipped aws plugin wiring patterns that the dynamodb plugin MUST follow.
- It exists to remove the need for importing upstream commander typings and aws plugin source into `.stan/imports/**` in future threads, while keeping the requirements precise and actionable.

## Commander typing model (authoritative; @commander-js/extra-typings)

Dependencies

- The plugin MUST import Commander types and errors from `@commander-js/extra-typings` (not `commander`).
- The plugin MUST type action handlers by relying on Commander inference rather than `Record<string, unknown>` and local casts.

### Action callback arity (hard rule)

Rule

- Commander action callback parameters depend on the command’s declared arguments.
- If you do not declare any `.argument(...)`, the action receives only the options object and the `thisCommand` instance (plus `this` binding).
- If you declare arguments (e.g., `.argument('[args...]')`), the action receives those args first, then options, then `thisCommand`.

Normative type excerpt (for reference; not vendored)

```ts
// From @commander-js/extra-typings Command.action:
action(
  fn: (this: this, ...args: [...Args, Opts, this]) => void | Promise<void>,
): this;
```

Implications

- For options-only commands (no `.argument(...)`), you MUST write:
  - `.action(async (opts, thisCommand) => { ... })`
- For commands with one declared argument list, you MUST write:
  - `.action(async (args, opts, thisCommand) => { ... })`

Example (matches shipped aws default action style)

```ts
awsCmd.argument('[args...]').action(async (args, opts, thisCommand) => {
  // args is typed from the argument usage; opts typed from .option declarations
});
```

### Option typing and property names (hard rule)

Rule

- Option names are inferred from flags and converted to camelCase property keys.
- Negated boolean flags (`--no-foo`) produce the same option key (`foo`) with inverted semantics.

Normative type excerpt (for reference; not vendored)

```ts
// @commander-js/extra-typings defines:
// - ConvertFlagToName maps '--some-flag' to 'someFlag' and '--no-some-flag' to 'someFlag'.
// - InferOptions builds the resulting options object type.
// - Command.option overloads return Command<Args, NewOpts, ...> with inferred opts.
```

Therefore

- Prefer calling options via `opts.tablesPath`, `opts.tokenEntityManager`, `opts.maxSeconds`, etc. after declaring them in Commander.
- Avoid `opts['tables-path']` style indexing.

### Strict numeric parsing (hard rule)

Goal

- Numeric option values MUST be rejected at parse time (not best-effort coerced at runtime), and action handlers must receive typed `number` values.

Authoritative requirement

- Every numeric option MUST supply a parser (Commander argParser) that:
  - converts to `number`,
  - throws `InvalidArgumentError` when non-finite or invalid,
  - enforces domain constraints where relevant (e.g., port must be a positive integer).

Reference pattern

```ts
import { InvalidArgumentError } from '@commander-js/extra-typings';

export const parseFiniteNumber = (label: string) => (raw: string) => {
  const n = Number(raw);
  if (!Number.isFinite(n))
    throw new InvalidArgumentError(`${label} must be a number`);
  return n;
};

export const parsePositiveInt = (label: string) => (raw: string) => {
  const n = parseFiniteNumber(label)(raw);
  if (!Number.isInteger(n) || n <= 0)
    throw new InvalidArgumentError(`${label} must be a positive integer`);
  return n;
};
```

## get-dotenv host model requirements (authoritative)

Context availability (hard rule)

- At action time, `cli.getCtx()` MUST be treated as non-optional.
- Do not write optional chains like `cli.getCtx()?.dotenv`; those are invalid under the current host typings and should be removed.

Config typing and validation (hard rule)

- The plugin MUST define a Zod config schema and pass it to `definePlugin({ configSchema })`.
- The plugin MUST read config via `plugin.readConfig(cli)` (instance-bound helper), which returns a validated and interpolated config slice keyed by the realized mount path.
- Do not read config by indexing `ctx.pluginConfigs[...]`; mount path resolution makes that brittle.

Interpolation boundary (hard rule)

- Host behavior: plugin config strings are interpolated once before plugin code runs.
- Plugin behavior: do not re-expand config-origin strings inside resolvers; expand runtime flags once if desired (current codebase uses `dotenvExpand` / `interpolateDeep` on flags only).

Root options bag (shell/capture/etc)

- The plugin MUST read root options via `readMergedOptions(thisCommand)` inside action handlers.
- The plugin MUST determine capture via `shouldCapture(bag.capture)`.

Normative type excerpts (for reference; not vendored)

```ts
// From @karmaniverous/get-dotenv/cliHost:
readMergedOptions(cmd: CommandUnknownOpts): GetDotenvCliOptions;
shouldCapture(bagCapture?: boolean): boolean;
buildSpawnEnv(base?: NodeJS.ProcessEnv, overlay?: Record<string, string | undefined>): NodeJS.ProcessEnv;
```

## Typed plugin instance seam (aws-pattern; hard rule)

Goal

- `plugin.readConfig(cli)` must never be `unknown` inside register functions; avoid brittle retyping.

Authoritative requirement

- Define and use a shared plugin instance type that threads `DynamodbPluginConfig` into `PluginWithInstanceHelpers`, and use that type in every `register*` function signature.
- Do not re-type `readConfig` via an intersection with a narrower signature; prefer a single typed instance alias.

Conceptual example

```ts
// export type DynamodbPluginInstance = PluginWithInstanceHelpers<GetDotenvOptions, DynamodbPluginConfig>;
//
// export function registerGenerate(plugin: DynamodbPluginInstance, cli: GetDotenvCliPublic, group: Command) { ... }
```

## Dynamic help descriptions (aws-pattern; scope-limited)

Goal

- Use `plugin.createPluginDynamicOption` to show effective defaults in help output, matching shipped aws patterns, but only when defaults are stable and config-derived.

Authoritative requirement

- Dynamic help defaults MUST be based only on host-validated plugin config defaults/values (schema defaults + config file values).
- Dynamic help MUST NOT claim defaults for values derived from runtime env overlays (`process.env` / `ctx.dotenv`) unless those defaults are represented in config.

Reference pattern (from shipped aws plugin)

```ts
plugin.createPluginDynamicOption(
  cli,
  '--profile <string>',
  (_bag, cfg) =>
    `AWS profile name${cfg.profile ? ` (default: ${JSON.stringify(cfg.profile)})` : ''}`,
);
```

Recommended usage in dynamodb plugin

- Use dynamic options for:
  - `tablesPath`, `tokens.*` (when present in plugin config)
  - `local.port`, `local.endpoint` (when present in plugin config)
  - boolean toggles that have schema defaults (e.g., `create.validate`, `create.refreshGenerated`, `generate.force` if modeled)
- Do not add dynamic “default” labels for:
  - table names that are typically env-driven (`TABLE_NAME`, `DYNAMODB_TABLE`)
  - values derived by computation at runtime (e.g., “default endpoint derived from DYNAMODB_LOCAL_PORT”), unless those are explicitly config defaults.

## Canonical action wiring (aws-pattern; hard rule)

Authoritative structure

- In every action handler, follow this order:
  - Read root bag: `const bag = readMergedOptions(thisCommand);`
  - Compute capture: `const capture = shouldCapture(bag.capture);`
  - Read ctx: `const ctx = cli.getCtx();`
  - Read plugin config: `const cfg = plugin.readConfig(cli);`
  - Apply canonical precedence via resolver functions (flags > config > defaults).
  - Call pure services (no business logic in the adapter).
  - Print output and set `process.exitCode` (do not `process.exit`).

Notes from shipped aws plugin (reference behavior)

- The aws plugin may `process.exit` because it optionally forwards to the external AWS CLI; the dynamodb plugin MUST NOT do this and must remain `process.exitCode`-driven for testability and embedding.

Help rendering guard for hooks

- If any hooks are used (e.g., `preSubcommand`), they MUST guard against help rendering side effects by returning early when argv includes `-h` or `--help` (matches shipped aws behavior).

## Fixtures-first testing strategy (authoritative)

Goal

- Maximize use of real Commander and real get-dotenv host behavior so signature mismatches and option parser issues are caught by runtime invocation.

Authoritative requirements

- Prefer integration-style tests that:
  - construct a real get-dotenv CLI host (`createCli` or `GetDotenvCli`),
  - mount the dynamodb plugin using `.use(dynamodbPlugin())`,
  - run commands by parsing argv (Commander calls action handlers),
  - mock only leaf modules that perform IO or AWS calls (services, EM loader, child-process executors).
- Avoid FakeGroup/hand-rolled stubs that call action handlers directly with ad-hoc argument shapes; those tests can mask real Commander arity and typing issues.

Mocking guidance (hard rule)

- Do not partially mock `@karmaniverous/get-dotenv/cliHost` by returning only some exports; this can cause runtime failures when command modules import other helpers from the same module.
- If mocking cliHost becomes unavoidable for a narrow case, use `vi.importActual` and spread the real exports, overriding only specific functions.

Mount-path config testing (recommended)

- To test realized mount path behavior (e.g., config key `aws/dynamodb`), prefer using a lightweight parent fixture plugin rather than the full aws plugin (to avoid credential resolution side effects), while still exercising realized mount path resolution.

## aws plugin source patterns to follow (reference excerpts)

These are the patterns the dynamodb plugin is expected to mirror; they are included here so you can remove imported aws plugin source next thread.

Root bag + capture

```ts
const bag = readMergedOptions(thisCommand);
const capture = shouldCapture(bag.capture);
```

Child env composition

```ts
const env = buildSpawnEnv(process.env, ctx.dotenv);
```

Tri-state overrides from opts (preserve explicit --no-\*)

```ts
if (Object.prototype.hasOwnProperty.call(o, 'loginOnDemand')) {
  overlay.loginOnDemand = Boolean(o.loginOnDemand);
}
```

Pre-subcommand hook help guard

```ts
if (process.argv.includes('-h') || process.argv.includes('--help')) return;
```

Dynamic help option descriptions (instance-bound config)

```ts
plugin.createPluginDynamicOption(cli, '--region <string>', (_bag, cfg) => {
  return `AWS region${cfg.region ? ` (default: ${JSON.stringify(cfg.region)})` : ''}`;
});
```
