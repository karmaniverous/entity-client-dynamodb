---
title: Config & Validation
---

# Authoring Plugins: Config & Validation

The host discovers config in packaged and project roots, overlays privacy (public/local) and source (packaged/project), and exposes the merged result to plugins. Plugin config lives under `plugins.<mount-path>` (realized namespace path, e.g., `aws/whoami`) in getdotenv.config.\*.

## Overlay and interpolation timing

Order of operations (high level):

1. Compose dotenv from files (exclude dynamic for the base), then apply dynamic (programmatic + JS/TS config + file dynamicPath).
2. Interpolate remaining string options (Phase C), e.g., outputPath.
3. Merge plugin config slices (packaged → project/public → project/local) and deep‑interpolate each plugin’s slice against `{ ...ctx.dotenv, ...process.env }` (process.env wins). Your plugin receives this interpolated slice via instance‑bound helpers.
4. Validate plugin config (when a schema is provided).

Implications:

- Strings coming from plugin config (including command strings) are interpolated once before your code runs; treat them as final to avoid double‑expansion.
- If you need late interpolation for a specific option, document it and expand exactly once in your plugin.

## JSON/YAML vs JS/TS

- JSON/YAML config supports data fields only (`vars`, `envVars`, `scripts`, `shell`, etc.). `dynamic` and `schema` are disallowed in JSON/YAML and must be authored in JS/TS config.
- JS/TS config supports `dynamic` (a map of string or `(vars, env?) => string | undefined`) and `schema` (e.g., a Zod object).

## Validating plugin config

If your plugin exposes a config shape, export a Zod schema and attach it to your plugin. The host validates the interpolated slice before `afterResolve`.

```ts
import { z } from 'zod';
import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';

export const MyPluginConfig = z.object({
  toolPath: z.string().optional(),
  // Rare, CLI-driven case only: plugin-scoped scripts
  scripts: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.object({
          cmd: z.string(),
          shell: z.union([z.string(), z.boolean()]).optional(),
        }),
      ]),
    )
    .optional(),
});
export type MyPluginConfig = z.infer<typeof MyPluginConfig>;

export const myPlugin = () => {
  const plugin = definePlugin({
    ns: 'my',
    configSchema: MyPluginConfig,
    setup(cli) {
      cli.ns('my').action(() => {
        const cfg = plugin.readConfig<MyPluginConfig>(cli);
        // cfg is validated and strings are already interpolated
      });
    },
  });
  return plugin;
};
```

## Typed accessor (DX)

When your plugin declares a config schema, prefer the instance‑bound helper to read the validated slice ergonomically at call sites. The helper is compile‑time only and preserves runtime behavior; the host still validates the interpolated slice against your schema before `afterResolve`.

```ts
import { z } from 'zod';
import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';

export const MyPluginConfig = z.object({
  toolPath: z.string().optional(),
  color: z.string().optional(),
});
export type MyPluginConfig = z.infer<typeof MyPluginConfig>;

export const myPlugin = () => {
  const plugin = definePlugin({
    ns: 'my',
    configSchema: MyPluginConfig,
    setup(cli) {
      cli.ns('my').action(() => {
        const cfg = plugin.readConfig(cli);
        // cfg is validated and strings are already interpolated once
      });
    },
  });
  return plugin;
};
```

## Plugin-scoped scripts (rare)

For CLI‑driven, arbitrary‑command plugins (like cmd/batch), you may offer `plugins.<mount-path>.scripts`. Prefer plugin‑scoped scripts over root scripts for clarity, and optionally fall back to root scripts when it improves UX. Use the object form to allow rare per‑script shell overrides; otherwise rely on the root shell. Inside your plugin code, prefer `plugin.readConfig(cli)` to access your validated slice.

## Runtime contract (validation & defaults)

- With a schema, the host materializes defaults by validating `{}` when no slice is present. Missing required fields without defaults fail early with a consolidated error.
- `plugin.readConfig(cli)` returns a concrete object (never `undefined`) after the host resolves context. Calling it before `resolveAndLoad()` throws a friendly error.

## Error reporting vs failure

The host surfaces config validation errors as exceptions by default (fail fast). If you want to warn and continue for non‑fatal cases, validate again locally in `setup` and provide user‑friendly guidance, but keep the schema strict to prevent silent misconfiguration.

See also:

- [Diagnostics](./diagnostics.md)
