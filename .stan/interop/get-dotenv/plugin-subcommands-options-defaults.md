---
title: Plugin subcommands with per-command options & defaults
originRepo: '@karmaniverous/entity-client-dynamodb'
targetRepo: '@karmaniverous/get-dotenv'
purpose: Interop note for get-dotenv STAN assistant guide
---

# Interop note: Plugins with subcommands, options, and defaults

This note is intended for inclusion (or adaptation) in the `@karmaniverous/get-dotenv` STAN assistant guide, so assistants and plugin authors have a canonical pattern for “one plugin namespace, many subcommands, each with its own options & defaults”.

## Why this matters (what get-dotenv didn’t need internally)

The shipped get-dotenv plugins are plugin-first and already follow strong patterns, but many downstream plugins are more complex than a single command: they expose a subtree like `aws <ns> <subcommand> ...` where each subcommand has its own flags, defaults, precedence rules, and service wiring.

In these plugins, the hard part is not adding subcommands; it is doing it in a way that remains:

- correct (flags > config > defaults, without double dotenv expansion),
- testable (wiring tests without running action handlers),
- maintainable (no business logic in command registration),
- typed (Commander inference where possible, and safe fallbacks where not).

This repo (`@karmaniverous/entity-client-dynamodb/get-dotenv`) solves this in a real plugin with multiple subcommands.

## The gap in the current get-dotenv STAN guide

The current guide mentions dynamic option descriptions and that you can pass a subcommand instance to `createPluginDynamicOption`, but it does not document the full “subcommand system” pattern:

- how to model per-subcommand defaults in a single plugin config schema,
- how to keep adapters thin via pure resolver functions,
- how to apply the host’s interpolation boundary correctly (config strings are interpolated once by the host; flags may be expanded once by the plugin),
- how to handle strict numeric parsing and the Commander typing caveat with `.addOption(createPluginDynamicOption(...))`,
- how to test command-tree registration and option presence reliably.

## Canonical pattern (recommended for third-party plugins)

### 1) Model per-subcommand defaults in the plugin config schema (nested objects)

Use a single plugin config slice keyed by realized mount path (e.g., `plugins["aws/<ns>"]`) and nest subcommand defaults under it. This makes it possible to show accurate defaults in help output and resolve inputs consistently per command.

Example shape (illustrative):

```ts
import { z } from '@karmaniverous/get-dotenv/cliHost';

export const MyPluginConfigSchema = z
  .object({
    sharedPath: z.string().optional(),
    tokens: z.object({ a: z.string().optional() }).optional(),

    generate: z.object({ version: z.string().optional() }).optional(),
    validate: z.object({ version: z.string().optional() }).optional(),
    create: z
      .object({
        version: z.string().optional(),
        waiter: z
          .object({ maxSeconds: z.union([z.number(), z.string()]).optional() })
          .optional(),
      })
      .optional(),
  })
  .strip();
```

Key benefit: you can reliably source dynamic help defaults from `plugin.readConfig(cli)` (schema defaults + config file values), without inventing per-subcommand config loading.

### 2) Keep command registration thin: register subcommands, then call resolvers + services

Command registration modules should do only:

- Commander `.command(...)` construction,
- declaring `.option(...)` / `.addOption(...)`,
- mapping `opts` into resolver inputs,
- calling pure services,
- formatting output and setting `process.exitCode`.

Avoid business logic (including precedence rules) in these modules.

Recommended structure:

- `cli/plugin/index.ts`: declares the plugin and registers subcommands
- `cli/plugin/commands/<cmd>.ts`: declares options and action handler wiring for one subcommand
- `cli/options/<cmd>.ts`: pure resolver for that subcommand (flags + config + envRef -> typed service input)
- `services/*`: pure or mostly-pure service modules (fs/network behind clear seams)

### 3) Use per-subcommand resolver functions (pure) to own precedence and expansion boundary

Implement a resolver per subcommand. This is the critical “missing chapter” for multi-command plugins.

Recommended signature:

```ts
export function resolveCreateAtVersion(
  flags: CreateFlags,
  config: MyPluginConfig | undefined,
  ref: Record<string, string | undefined> = process.env,
): { version: string; options: CreateOptions; cfg: LayoutConfig } {
  // flags > config > defaults
  // expand flags once (if desired)
  // do not re-expand config strings (host already interpolated them once)
}
```

Why: it centralizes precedence, allows unit tests without Commander, and prevents action handlers from becoming “mini-resolvers”.

### 4) Respect the host interpolation boundary (avoid double expansion)

Host behavior: plugin config string leaves are interpolated once before plugin code runs. Therefore:

- do not re-expand config-origin strings inside your plugin code,
- expand runtime flags once at action time if you want flags to see `ctx.dotenv`,
- always expand against `{ ...process.env, ...ctx.dotenv }` so the resolved dotenv context wins.

Illustrative policy:

```ts
const ctx = cli.getCtx();
const envRef = { ...process.env, ...ctx.dotenv };

// Expand flags only:
const tableNameFromFlags = dotenvExpand(opts.tableName, envRef);

// Config strings are assumed already interpolated by host:
const tableNameFromCfg = pluginCfg.delete?.tableName;
```

### 5) Dynamic option descriptions: target the subcommand, and only claim config-derived defaults

Dynamic help is valuable, but it must not lie. Guidance:

- use `plugin.createPluginDynamicOption(<subcommand>, ...)` so help rendering is scoped correctly,
- show defaults only when they come from plugin config (validated + interpolated), not from runtime-derived env fallbacks unless those are explicitly represented in config defaults.

Example:

```ts
const del = group.command('delete');
del.addOption(
  plugin.createPluginDynamicOption(
    del,
    '--max-seconds <number>',
    (_bag, cfg) =>
      `waiter max seconds${cfg.delete?.waiter?.maxSeconds !== undefined ? ` (default: ${JSON.stringify(cfg.delete.waiter.maxSeconds)})` : ''}`,
  ),
);
```

### 6) Strict numeric parsing: use parsers that throw InvalidArgumentError

Numeric options should fail fast at parse time (not later in services).

Reference parser pattern:

```ts
import { InvalidArgumentError } from '@commander-js/extra-typings';

export const parsePositiveInt =
  (label: string) =>
  (raw: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new InvalidArgumentError(`${label} must be a positive integer`);
    }
    return n;
  };
```

### 7) Commander typing caveat: `.addOption(createPluginDynamicOption(...))` may not narrow `opts`

This is the practical issue that downstream plugins run into and need documented guidance for.

Even when you provide a numeric parser to `createPluginDynamicOption`, TypeScript may not reflect the refined type in the `.action((opts) => ...)` options object because the option is being attached via `.addOption(...)` with a helper-generated `Option`.

Practical guidance:

- rely on strict runtime parsing to reject invalid values,
- still normalize/convert when threading into strictly-typed service inputs:

```ts
// Example: portOverride?: number
const portOverride = opts.port !== undefined ? Number(opts.port) : undefined;
```

This is not about weakening runtime validation; it is about bridging a TS inference limitation.

### 8) Testing strategy: unit tests for resolvers/services + wiring tests for registration

Recommended confidence layering:

- Unit tests:
  - resolvers (flags/config/envRef merging, expansion boundary, numeric coercion),
  - services (pure logic; mock fs/network at seams).
- Wiring tests (registration smoke tests):
  - instantiate a real get-dotenv CLI host (e.g., `new GetDotenvCli(...)`),
  - mount the plugin and `await cli.install()`,
  - assert command tree contains expected subcommands and options.

This catches “wrong action handler arity”, “missing option”, and “command not registered” issues without brittle tests that execute action handlers.

Mocking guidance when cliHost helpers are needed:

- avoid partial module mocks that omit exports used elsewhere,
- prefer `vi.importActual` and override only specific functions (if mocking is unavoidable).

### 9) Optional doc hygiene note: avoid duplicated guide content

If the STAN guide is generated/assembled from multiple sources, ensure the published “index guide” does not accidentally include duplicated sections (which can confuse assistants about the canonical location of specific guidance).

## Suggested placements inside get-dotenv documentation (let maintainers choose)

Two viable placements (both work):

- Add a new topic page under the STAN assistant guide tree: “Plugin subcommands: defaults, resolvers, and tests”.
- Extend the existing “Authoring Hosts & Plugins” topic with a dedicated subsection and link to a short resolver/testing appendix.

Primary acceptance criteria for documentation: a third-party plugin author should be able to implement a multi-subcommand plugin without inventing their own precedence rules or testing approach.

## Concrete reference implementation (this repo)

If you want a working example to mirror, see the DynamoDB plugin in `@karmaniverous/entity-client-dynamodb/get-dotenv`:

- Plugin registration and command tree:
  - `src/get-dotenv/cli/plugin/index.ts`
  - `src/get-dotenv/cli/plugin/commands/*`
- Pure resolvers (flags > config > defaults; expand flags once):
  - `src/get-dotenv/cli/options/*`
- Strict numeric parsers:
  - `src/get-dotenv/cli/plugin/parsers.ts`
- Wiring tests (registration smoke tests):
  - `src/get-dotenv/cli/plugin/commands/*.wiring.test.ts`
- Resolver unit tests:
  - `src/get-dotenv/cli/options.test.ts`
