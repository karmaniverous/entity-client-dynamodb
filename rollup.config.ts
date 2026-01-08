/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { readFileSync } from 'node:fs';

import aliasPlugin, { type Alias } from '@rollup/plugin-alias';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import stripPlugin from '@rollup/plugin-strip';
import typescriptPlugin from '@rollup/plugin-typescript';
import type { InputOptions, RollupOptions } from 'rollup';
import dtsPlugin from 'rollup-plugin-dts';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

const outputPath = `dist`;

/**
 * Extract a package name from an import specifier so we can treat subpath exports
 * as external dependencies.
 *
 * Examples:
 * - "\@karmaniverous/get-dotenv/cliHost" -\> "\@karmaniverous/get-dotenv"
 * - "radash" -\> "radash"
 * - "./local" -\> undefined
 */
function packageNameFromImport(id: string): string | undefined {
  if (id.startsWith('.') || id.startsWith('/') || id.startsWith('\0'))
    return undefined;
  if (id.startsWith('node:')) return 'node:';
  const parts = id.split('/');
  if (id.startsWith('@')) {
    if (parts.length < 2) return undefined;
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

type Package = Record<string, Record<string, string> | undefined>;

const externalPackages = new Set<string>([
  ...Object.keys((pkg as unknown as Package).dependencies ?? {}),
  ...Object.keys((pkg as unknown as Package).peerDependencies ?? {}),
  'tslib',
  // Optional runtime dependency used only when the get-dotenv "local" service
  // chooses the embedded fallback. Keep it external to avoid bundling heavy
  // transitive deps into dist outputs (and to keep build logs clean).
  '@karmaniverous/dynamodb-local',
]);

const isExternal = (id: string): boolean => {
  if (externalPackages.has(id)) return true;
  const pkgName = packageNameFromImport(id);
  if (!pkgName) return false;
  if (pkgName === 'node:') return true;
  return externalPackages.has(pkgName);
};

const commonPlugins = [
  stripPlugin({ include: ['**/*.ts'] }),
  commonjsPlugin(),
  jsonPlugin(),
  nodeResolve(),
  typescriptPlugin(),
];

const commonAliases: Alias[] = [];

const entryPoints = ['src/index.ts', 'src/get-dotenv/index.ts'] as const;

const commonInputOptions: InputOptions = {
  external: isExternal,
  input: [...entryPoints],
  plugins: [aliasPlugin({ entries: commonAliases }), ...commonPlugins],
};

const config: RollupOptions[] = [
  // ESM output.
  {
    ...commonInputOptions,
    output: [
      {
        dir: `${outputPath}/mjs`,
        extend: true,
        format: 'esm',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    ],
  },

  // CommonJS output.
  {
    ...commonInputOptions,
    output: [
      {
        dir: `${outputPath}/cjs`,
        extend: true,
        format: 'cjs',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    ],
  },

  // Type definitions output (root).
  {
    ...commonInputOptions,
    input: 'src/index.ts',
    // Rebuild plugin list locally to avoid spreading a possibly non-iterable
    // InputPluginOption union (fixes TS2488 in typed builds).
    plugins: [
      aliasPlugin({ entries: commonAliases }),
      ...commonPlugins,
      dtsPlugin(),
    ],
    output: [
      {
        extend: true,
        file: `${outputPath}/index.d.ts`,
        format: 'esm',
      },
    ],
  },

  // Type definitions output (get-dotenv subpath).
  {
    ...commonInputOptions,
    input: 'src/get-dotenv/index.ts',
    // Rebuild plugin list locally to avoid spreading a possibly non-iterable
    // InputPluginOption union (fixes TS2488 in typed builds).
    plugins: [
      aliasPlugin({ entries: commonAliases }),
      ...commonPlugins,
      dtsPlugin(),
    ],
    output: [
      {
        extend: true,
        file: `${outputPath}/get-dotenv/index.d.ts`,
        format: 'esm',
      },
    ],
  },
];

export default config;
