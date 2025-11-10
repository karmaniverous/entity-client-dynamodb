# Development plan

## Next up

## Completed (recent)

- Migrate tests from Mocha/NYC to Vitest.
  - Added vitest and @vitest/coverage-v8 devDependencies.
  - Created vitest.config.ts with Node env, globals, and V8 coverage reporters.
  - Switched npm "test" script to run Vitest with coverage under dotenvx.
  - Updated tsconfig.json to limit "types" to ["node", "vitest"], disabled
    checkJs/allowJs, and restricted includes to "src/\*_/_" to avoid pulling in
    JS configs (fixes 'eslint\_\_js' type errors in typecheck/docs/build).
  - Removed mocha plugin from eslint.config.js to fix flat-config errors; kept
    Prettier, TS-ESLint, TSDoc, and import sorting.
  - Updated tests to import expect from vitest; removed Mocha/NYC configs and
    updated VS Code recommendations/settings.
  - Refined toolchain to stabilize after Vitest migration:
    - tsconfig.json: removed global Vitest types and excluded \*.test.ts from the
      main TS program so tsc/typedoc/build don’t require Vitest types.
    - eslint.config.js: added test-file override to declare vitest globals and
      disable type-info-heavy unsafe rules that are noisy in tests.
    - rollup.config.ts: replaced JSON import assertion with createRequire to fix
      “Unexpected identifier 'assert'” when loading the config.
  - Migrated ESLint to a flat, type-aware TypeScript config.
    - Created eslint.config.ts with strict typed lint for sources, Prettier
      integration, import sorting, and TSDoc syntax checks.
    - Added untyped override and Vitest globals for \*.test.ts to avoid TSConfig
      inclusion errors during lint runs. Removed eslint.config.js.
    - Scoped type-aware ESLint rules to src/\*_/_.ts only and disabled
      type-checked rules for test files using typescript-eslint
      disableTypeChecked config. This resolves errors such as
      "@typescript-eslint/await-thenable requires type information" when
      linting tests without parserOptions.project.
    - Removed reliance on typescript-eslint disableTypeChecked preset (not
      iterable in this setup). Instead, explicitly ignored src/\*_/_.test.ts
      within the typed config block and kept an untyped test override with
      Vitest globals.
  - Enforce typed ESLint rules for all TS files (tests included).
    - Updated eslint.config.ts to apply strictTypeChecked to \*_/_.ts and use the
      root tsconfig.json (no dedicated ESLint tsconfig). Kept only Vitest
      globals override for tests without disabling rules.
    - Updated tsconfig.json to include tests and provide Vitest globals
      (types: ["node", "vitest/globals"]) so typed lint has full type
      information across test files.
  - Resolve typecheck/docs duplicates from Chai types with Vitest:
    - Removed @types/chai and chai from devDependencies to avoid conflicts with
      Vitest’s bundled Chai typings.
  - Prevent Vitest from attempting to run type-only checks as runtime tests:
    - Renamed src/MutuallyExclusive.test.ts (type-level assertions only) to
      src/MutuallyExclusive.types.ts so it remains type-checked and linted but
      is not collected as a Vitest runtime suite.
  - Build: fixed Rollup config to avoid JSON import assertions.
    - Updated rollup.config.ts to load package.json via createRequire instead of
      `assert { type: 'json' }`, resolving “Unexpected identifier 'assert'”.
    - Flattened DTS plugin config to avoid nested arrays:
      `plugins: [...(commonInputOptions.plugins ?? []), dtsPlugin()]`.
  - Build: ensure Rollup applies TypeScript to rollup.config.ts
    - Updated package.json build script to use `--configPlugin typescript`
      (recognized plugin name for @rollup/plugin-typescript), so the config in
      TypeScript is compiled and parsed correctly.
  - Build: keep Rollup config in TypeScript per template
    - Switched build script to `--configPlugin @rollup/plugin-typescript` so the
      TS config is compiled reliably (aligns with template repo). No migration
      away from TS config.
  - Build: align rollup.config.ts with template (JS-compatible TS)
    - Removed TypeScript-only syntax (type imports/annotations) from
      rollup.config.ts so Rollup can parse it without special loaders, while
      keeping the file in TypeScript. Kept createRequire for package.json and
      flattened DTS plugins array. This matches the template behavior where the
      TS config builds cleanly without NODE_OPTIONS or ts-node loaders.
  - Cleanup: remove unused Mocha/NYC tooling and legacy type packages; update keywords
    - Removed devDependencies no longer used after Vitest migration:
      @types/eslint\_\_js, @types/eslint-config-prettier, @types/eslint-plugin-mocha,
      @types/mocha, eslint-plugin-mocha, jsdom-global, mocha, nyc,
      source-map-support, ts-node, tsd.
    - Updated package keywords: drop mocha/nyc/chai; add vitest.
  - Build: confirmed template-aligned TS Rollup config builds cleanly with
    `@rollup/plugin-typescript` on rollup.config.ts; removing the “Next up” build
    investigation item.

  - Knip: resolve unused file/dependency reports
    - Ignored type-only test file and docs assets: src/MutuallyExclusive.types.ts, docs/\*\*.
    - Ignored dev dependencies used via scripts/CLI outside code scanning:
      auto-changelog (release-it hooks), cross-env (STAN build script).
    - Updated STAN build warnPattern to robustly ignore Rollup Typescript
      “outputToFilesystem option is defaulting to true” (covers both spellings).

  - Knip + type tests:
    - Ported type-only MutuallyExclusive checks to Vitest using expectTypeOf
      (src/MutuallyExclusive.test.ts) and removed the standalone
      src/MutuallyExclusive.types.ts.
    - Knip config now ignores docs/\*\* and script-only dev dependencies
      (auto-changelog via release-it hooks, cross-env via STAN scripts).
    - Updated STAN build warnPattern to use a dot-all negative lookahead so the
      Rollup TS “outputToFilesystem option is defaulting to true” line is ignored.

  - Type tests: migrate to tsd
    - Added tsd devDependency and npm script "type:test".
    - Created tsd.config.json with directory tests/types and strict compiler options.
    - Added tests/types/MutuallyExclusive.test-d.ts covering type cases using
      tsd expectType/expectAssignable/expectNotAssignable; removed Vitest-only
      type assertions from runtime tests.
  - STAN build: ignore rollup plugin typescript defaulting warning
    - Simplified build warnPattern to match the exact message so it is ignored reliably.

  - Knip: ignore tsd type tests
    - Updated knip.json to ignore tests/types/\*\* so type tests consumed by the
      tsd CLI are not reported as unused files.

  - STAN build warnPattern: match other warnings, ignore defaulting notice
    - Updated warnPattern to select Rollup warning lines that start with "(!) "
      while excluding the specific "@rollup/plugin-typescript: outputToFile[Ss]ystem option is defaulting to true"
      message. This surfaces real warnings and suppresses the benign notice.

  - Type fixes after widening tsconfig include:
    - rollup.config.ts: typed alias entries (no implicit any) with a local
      RollupAliasEntry type; kept config TS and template-aligned.
    - tsd tests: narrowed union error assertions using Extract so assertions
      target the error branch and not the union (fixes TS2345).
    - vitest.config.ts: removed coverage option "all" (not supported in Vitest v4).
    - tsconfig.json: excluded tests/\*\* so build/docs/tsc do not compile tsd
      type tests (tsd runs them separately).
  - Typecheck: ensure tsd runs by invoking tests in tests/types.
    - Updated npm script "typecheck" to
      "tsc && tsd tests/types" so the tsd CLI targets the configured type
      tests directory and does not look for dist/index.test-d.ts. This should
      pass locally and in CI.

  - ESLint: integrate @vitest/eslint-plugin for test rules
    - Added devDependency @vitest/eslint-plugin.
    - Updated eslint.config.ts to load the plugin and apply
      vitestPlugin.configs.recommended rules to \*_/_.test.ts.
    - Kept explicit Vitest globals for describe/it/expect.
  - Amendment: Typecheck: run "tsd" without a path so tsd.config.json's directory is honored (fixes lookup under tests/types).

  - Type tests: make tsd discover tests without changing scripts/config
    - Added test-d/index.test-d.ts harness that imports our existing tests
      from tests/types, matching tsd's default discovery rules.
    - Updated knip.json to ignore test-d/\*\*.

  - TSD: stabilize MutuallyExclusive types and tests
    - Updated src/MutuallyExclusive.ts to avoid distributive conditionals and
      to skip `never` elements so inputs containing `never` return `true`.
    - Updated tests/types/MutuallyExclusive.test-d.ts to use
      expectAssignable for error-shape checks with literal message types.
  - Docs: README exports pass and examples
    - Expanded README with an exports overview, installation, and examples
      for sort, updateRecord, conditionalize, isNil, and defaultTranscodes.
    - Corrected a minor export issue discovered while documenting:
      re-exported `conditionalize` as a value (runtime function).