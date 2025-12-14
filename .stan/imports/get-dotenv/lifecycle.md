---
title: Lifecycle & Wiring
---

# Authoring Plugins: Lifecycle & Wiring

Plugins are small modules that register commands and behavior against the plugin‑first host. The host resolves dotenv context once per invocation, overlays config, validates, and then runs your plugin’s setup and optional afterResolve hooks. See also: [Config & Validation](./config.md), [Diagnostics & Errors](./diagnostics.md), and [Executing Shell Commands](./exec.md).

## Minimal plugin

```ts
import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';

export const helloPlugin = () =>
  definePlugin({
    ns: 'hello',
    setup(cli) {
      cli
        .description('Say hello')
        .action(() => {
          const ctx = cli.getCtx();
          console.log('hello', Object.keys(ctx.dotenv).length);
        });
    },
  });
```

## Wiring a host

```ts
#!/usr/bin/env node
import { createCli } from '@karmaniverous/get-dotenv/cli';
import {
  cmdPlugin,
  batchPlugin,
  awsPlugin,
  initPlugin,
} from '@karmaniverous/get-dotenv/plugins';
import { helloPlugin } from './plugins/hello';

const run = createCli({
  alias: 'toolbox',
  branding: 'Toolbox CLI',
  compose: (p) =>
    p
      .use(
        cmdPlugin({ asDefault: true, optionAlias: '-c, --cmd <command...>' }),
      )
      .use(batchPlugin())
      .use(awsPlugin())
      .use(initPlugin())
      .use(helloPlugin()),
});

await run();
```

### Access the true root command (typed helper)

When you need the real root command (for branding, alias labels, or reading root‑level metadata) from inside a plugin mount or action, use the small typed helper exported by the host:

```ts
import {
  definePlugin,
  getRootCommand,
} from '@karmaniverous/get-dotenv/cliHost';

export const helloPlugin = () => {
  const plugin = definePlugin({
    ns: 'hello',
    setup(cli) {
      cli.action(() => {
        const root = getRootCommand(cli); // typed Commander root
        // Example: include the root name in your output
        console.log(`[${root.name()}] hello from plugin`);
      });
    },
  });
  return plugin;
};
```

For a fuller example in context, see the scaffolded template plugin at [templates/cli/plugins/hello.ts](../../templates/cli/plugins/hello.ts).

Notes:

- The `compose` hook runs before parsing and is the recommended way to assemble your CLI surface. The factory installs root options and hooks so shipped plugins can read the merged options bag with `readMergedOptions()`.
- If you construct a host directly, mirror the shipped wiring (root options + root hooks) before attaching shipped plugins. For most use cases, `createCli` is simpler and safer.

## Branding the host

When using the factory, prefer the `branding` option:

```ts
await createCli({
  alias: 'toolbox',
  branding: 'toolbox v1.0.0', // optional help header
  compose: (p) => p /* ...wire plugins... */,
}).run(process.argv.slice(2));
```

If you construct a host directly, call `program.brand({ importMetaUrl, description })` before parsing.

## Accessing context and options

Inside actions, prefer the structural helpers:

```ts
import { readMergedOptions } from '@karmaniverous/get-dotenv/cliHost';

cli.ns('print').action((_args, _opts, thisCommand) => {
  const bag = readMergedOptions(thisCommand) ?? {};
  const ctx = cli.getCtx();
  // bag contains merged root options (scripts, shell, capture, trace, etc.)
  // ctx.dotenv contains the final merged env (after overlays and dynamics)
});
```

If your plugin accepts option values that may include environment references (for example, `--table-name '${TABLE_NAME}'`), expand them yourself at action time using the resolved context (so you are not dependent on `loadProcess`). See [Executing Shell Commands](./exec.md#expanding-environment-references-in-plugin-flag-values) for recommended patterns and cross-platform quoting guidance.

See also:

- Config & Validation
- Executing Shell Commands

## Dynamic option descriptions

Prefer the plugin‑bound helper createPluginDynamicOption to render help text that reflects the resolved configuration for that specific plugin instance. The host evaluates dynamic descriptions with overlays and dynamic enabled, without logging or mutating the environment.

Key points:

- createPluginDynamicOption(cli, flags, (cfg, pluginCfg) => string, parser?, defaultValue?) attaches to the current plugin, injecting that plugin’s validated config slice (pluginCfg).
- The callback receives a read‑only resolved help config (top‑level flags) and the instance‑bound plugin config slice. Avoid by‑id lookups (e.g., cfg.plugins.<id>); rely on pluginCfg instead.
- Top‑level “-h/--help” computes a read‑only config and evaluates dynamic text; “help <cmd>” refreshes dynamic text after preSubcommand resolution.

Example (plugin flag with ON/OFF default label using instance‑bound config):

```ts
import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';

type HelloConfig = { loud?: boolean };

export const helloPlugin = () => {
  const plugin = definePlugin({
    ns: 'hello',
    setup(cli) {
      cli
        .description('Say hello with current dotenv context')
        .addOption(
          plugin.createPluginDynamicOption<HelloConfig>(
            cli,
            '--loud',
            (_bag, cfg) =>
              `print greeting in ALL CAPS${cfg.loud ? ' (default)' : ''}`,
          ),
        )
        .action(() => {
          const cfg = plugin.readConfig<HelloConfig>(cli);
          // use cfg.loud at runtime
        });
    },
  });
  return plugin;
};
```

Or build the Option first:

```ts
const opt = plugin.createPluginDynamicOption<{ color?: string }>(
  cli,
  '--color <string>',
  (_bag, cfg) => `text color (default: ${JSON.stringify(cfg.color ?? 'blue')})`,
);
cli.addOption(opt);
```

Notes:

- Use concise labels for ON/OFF toggles (e.g., “(default)”) and “(default: "...")” for string defaults.
- Plugin config is validated and deep‑interpolated once by the host; read it via plugin.readConfig(cli).

Update (DX: no undefined):

- With the current host, readConfig returns a concrete object (never undefined). Defaults are materialized from the schema when no slice is present.
- The dynamic option callback receives a concrete plugin config object too, so you can reference cfg.foo without optional chaining when you have defaults in your schema.
