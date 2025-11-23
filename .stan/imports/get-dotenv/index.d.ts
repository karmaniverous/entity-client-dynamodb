import { Command } from 'commander';

/** src/cliCore/spawnEnv.ts
 * Build a sanitized environment bag for child processes.
 *
 * Requirements addressed:
 * - Provide a single helper (buildSpawnEnv) to normalize/dedupe child env.
 * - Drop undefined values (exactOptional semantics).
 * - On Windows, dedupe keys case-insensitively and prefer the last value,
 *   preserving the latest key's casing. Ensure HOME fallback from USERPROFILE.
 *   Normalize TMP/TEMP consistency when either is present.
 * - On POSIX, keep keys as-is; when a temp dir key is present (TMPDIR/TMP/TEMP),
 *   ensure TMPDIR exists for downstream consumers that expect it.
 *
 * Adapter responsibility: pure mapping; no business logic.
 */
type SpawnEnv = Readonly<Partial<Record<string, string>>>;
/** Build a sanitized env for child processes from base + overlay. */
declare const buildSpawnEnv: (base?: NodeJS.ProcessEnv, overlay?: Record<string, string | undefined>) => SpawnEnv;

/**
 * Minimal root options shape shared by CLI and generator layers.
 * Keep keys optional to respect exactOptionalPropertyTypes semantics.
 */
type RootOptionsShape = {
    env?: string;
    vars?: string;
    command?: string;
    outputPath?: string;
    shell?: string | boolean;
    loadProcess?: boolean;
    excludeAll?: boolean;
    excludeDynamic?: boolean;
    excludeEnv?: boolean;
    excludeGlobal?: boolean;
    excludePrivate?: boolean;
    excludePublic?: boolean;
    log?: boolean;
    debug?: boolean;
    capture?: boolean;
    strict?: boolean;
    redact?: boolean;
    warnEntropy?: boolean;
    entropyThreshold?: number;
    entropyMinLength?: number;
    entropyWhitelist?: string[];
    redactPatterns?: string[];
    defaultEnv?: string;
    dotenvToken?: string;
    dynamicPath?: string;
    trace?: boolean | string[];
    paths?: string;
    pathsDelimiter?: string;
    pathsDelimiterPattern?: string;
    privateToken?: string;
    varsDelimiter?: string;
    varsDelimiterPattern?: string;
    varsAssignor?: string;
    varsAssignorPattern?: string;
    scripts?: ScriptsTable;
};
/**
 * Scripts table shape (configurable shell type).
 */
type ScriptsTable<TShell extends string | boolean = string | boolean> = Record<string, string | {
    cmd: string;
    shell?: TShell;
}>;

type RootOptionsShapeCompat = Omit<RootOptionsShape, 'vars' | 'paths'> & {
    vars?: string | Record<string, string | undefined>;
    paths?: string | string[];
};
/**
 * A minimal representation of an environment key/value mapping.
 * Values may be `undefined` to represent "unset". */ type ProcessEnv = Record<string, string | undefined>;
/**
 * Dynamic variable function signature. Receives the current expanded variables
 * and the selected environment (if any), and returns either a string to set
 * or `undefined` to unset/skip the variable.
 */
type GetDotenvDynamicFunction = (vars: ProcessEnv, env: string | undefined) => string | undefined;
type GetDotenvDynamic = Record<string, GetDotenvDynamicFunction | ReturnType<GetDotenvDynamicFunction>>;
type Logger = Record<string, (...args: unknown[]) => void> | typeof console;
/**
 * Helper to define a dynamic map with strong inference.
 *
 * @example
 * const dynamic = defineDynamic(\{ KEY: (\{ FOO = '' \}) =\> FOO + '-x' \});
 */
declare const defineDynamic: <T extends GetDotenvDynamic>(d: T) => T;
/**
 * Options passed programmatically to `getDotenv`.
 */
interface GetDotenvOptions {
    /**
     * default target environment (used if `env` is not provided)
     */
    defaultEnv?: string;
    /**
     * token indicating a dotenv file
     */
    dotenvToken: string;
    /**
     * path to JS/TS module default-exporting an object keyed to dynamic variable functions
     */
    dynamicPath?: string;
    /**
     * Programmatic dynamic variables map. When provided, this takes precedence
     * over {@link GetDotenvOptions.dynamicPath}.
     */
    dynamic?: GetDotenvDynamic;
    /**
     * target environment
     */
    env?: string;
    /**
     * exclude dynamic variables from loading
     */
    excludeDynamic?: boolean;
    /**
     * exclude environment-specific variables from loading
     */
    excludeEnv?: boolean;
    /**
     * exclude global variables from loading
     */
    excludeGlobal?: boolean;
    /**
     * exclude private variables from loading
     */
    excludePrivate?: boolean;
    /**
     * exclude public variables from loading
     */
    excludePublic?: boolean;
    /**
     * load dotenv variables to `process.env`
     */
    loadProcess?: boolean;
    /**
     * log loaded dotenv variables to `logger`
     */
    log?: boolean;
    /**
     * logger object (defaults to console)
     */
    logger?: Logger;
    /**
     * if populated, writes consolidated dotenv file to this path (follows dotenvExpand rules)
     */
    outputPath?: string;
    /**
     * array of input directory paths
     */
    paths?: string[];
    /**
     * filename token indicating private variables
     */
    privateToken?: string;
    /**
     * explicit variables to include
     */
    vars?: ProcessEnv;
    /**
     * Reserved: config loader flag (no-op).
     * The plugin-first host and generator paths already use the config
     * loader/overlay pipeline unconditionally (no-op when no config files
     * are present). This flag is accepted for forward compatibility but
     * currently has no effect.
     */
    useConfigLoader?: boolean;
}
/**
 * Converts programmatic CLI options to `getDotenv` options. *
 * @param cliOptions - CLI options. Defaults to `{}`.
 *
 * @returns `getDotenv` options.
 */
declare const getDotenvCliOptions2Options: ({ paths, pathsDelimiter, pathsDelimiterPattern, vars, varsAssignor, varsAssignorPattern, varsDelimiter, varsDelimiterPattern, ...rest }: RootOptionsShapeCompat) => GetDotenvOptions;

/**
 * Recursively expands environment variables in a string. Variables may be
 * presented with optional default as `$VAR[:default]` or `${VAR[:default]}`.
 * Unknown variables will expand to an empty string.
 *
 * @param value - The string to expand.
 * @param ref - The reference object to use for variable expansion.
 * @returns The expanded string.
 *
 * @example
 * ```ts
 * process.env.FOO = 'bar';
 * dotenvExpand('Hello $FOO'); // "Hello bar"
 * dotenvExpand('Hello $BAZ:world'); // "Hello world"
 * ```
 *
 * @remarks
 * The expansion is recursive. If a referenced variable itself contains
 * references, those will also be expanded until a stable value is reached.
 * Escaped references (e.g. `\$FOO`) are preserved as literals.
 */
declare const dotenvExpand: (value: string | undefined, ref?: ProcessEnv) => string | undefined;
/**
 * Recursively expands environment variables in the values of a JSON object.
 * Variables may be presented with optional default as `$VAR[:default]` or
 * `${VAR[:default]}`. Unknown variables will expand to an empty string.
 *
 * @param values - The values object to expand.
 * @param options - Expansion options.
 * @returns The value object with expanded string values.
 *
 * @example
 * ```ts
 * process.env.FOO = 'bar';
 * dotenvExpandAll({ A: '$FOO', B: 'x${FOO}y' });
 * // => { A: "bar", B: "xbary" }
 * ```
 *
 * @remarks
 * Options:
 * - ref: The reference object to use for expansion (defaults to process.env).
 * - progressive: Whether to progressively add expanded values to the set of
 *   reference keys.
 *
 * When `progressive` is true, each expanded key becomes available for
 * subsequent expansions in the same object (left-to-right by object key order).
 */
declare const dotenvExpandAll: (values?: ProcessEnv, options?: {
    ref?: ProcessEnv;
    progressive?: boolean;
}) => Record<string, string | undefined>;
/**
 * Recursively expands environment variables in a string using `process.env` as
 * the expansion reference. Variables may be presented with optional default as
 * `$VAR[:default]` or `${VAR[:default]}`. Unknown variables will expand to an
 * empty string.
 *
 * @param value - The string to expand.
 * @returns The expanded string.
 *
 * @example
 * ```ts
 * process.env.FOO = 'bar';
 * dotenvExpandFromProcessEnv('Hello $FOO'); // "Hello bar"
 * ```
 */
declare const dotenvExpandFromProcessEnv: (value: string | undefined) => string | undefined;

type Scripts = Record<string, string | {
    cmd: string;
    shell?: string | boolean;
}>;
/**
 * Options passed programmatically to `getDotenvCli`.
 */
interface GetDotenvCliOptions extends Omit<GetDotenvOptions, 'paths' | 'vars'> {
    /**
     * Logs CLI internals when true.
     */
    debug?: boolean;
    /**
     * Strict mode: fail the run when env validation issues are detected
     * (schema or requiredKeys). Warns by default when false or unset.
     */
    strict?: boolean;
    /**
     * Redaction (presentation): mask secret-like values in logs/trace.
     */
    redact?: boolean;
    /**
     * Entropy warnings (presentation): emit once-per-key warnings for high-entropy values.
     */
    warnEntropy?: boolean;
    entropyThreshold?: number;
    entropyMinLength?: number;
    entropyWhitelist?: string[];
    redactPatterns?: string[];
    /**
     * When true, capture child stdout/stderr and re-emit after completion.
     * Useful for tests/CI. Default behavior is streaming via stdio: 'inherit'.
     */
    capture?: boolean;
    /**
     * A delimited string of paths to dotenv files.
     */
    paths?: string;
    /**
     * A delimiter string with which to split `paths`. Only used if
     * `pathsDelimiterPattern` is not provided.
     */
    pathsDelimiter?: string;
    /**
     * A regular expression pattern with which to split `paths`. Supersedes
     * `pathsDelimiter`.
     */
    pathsDelimiterPattern?: string;
    /**
     * Scripts that can be executed from the CLI, either individually or via the batch subcommand.
     */
    scripts?: Scripts;
    /**
     * Determines how commands and scripts are executed. If `false` or
     * `undefined`, commands are executed as plain Javascript using the default
     * execa parser. If `true`, commands are executed using the default OS shell
     * parser. Otherwise the user may provide a specific shell string (e.g.
     * `/bin/bash`)
     */
    shell?: string | boolean;
    /**
     * A delimited string of key-value pairs declaratively specifying variables &
     * values to be loaded in addition to any dotenv files.
     */
    vars?: string;
    /**
     * A string with which to split keys from values in `vars`. Only used if
     * `varsDelimiterPattern` is not provided.
     */
    varsAssignor?: string;
    /**
     * A regular expression pattern with which to split variable names from values
     * in `vars`. Supersedes `varsAssignor`.
     */
    varsAssignorPattern?: string;
    /**
     * A string with which to split `vars` into key-value pairs. Only used if
     * `varsDelimiterPattern` is not provided.
     */
    varsDelimiter?: string;
    /**
     * A regular expression pattern with which to split `vars` into key-value
     * pairs. Supersedes `varsDelimiter`.
     */
    varsDelimiterPattern?: string;
}

/**
 * GetDotenv CLI Pre-hook Callback function type. Mutates inbound options &
 * executes side effects within the `getDotenv` context.
 */
type GetDotenvCliPreHookCallback = (options: GetDotenvCliOptions) => Promise<void>;
/**
 * GetDotenv CLI Post-hook Callback function type. Executes side effects within
 * the `getDotenv` context.
 */
type GetDotenvCliPostHookCallback = (dotenv: ProcessEnv) => Promise<void>;
/**
 * `generateGetDotenvCli` options. Defines local instance of the GetDotenv CLI and
 * sets defaults that can be overridden by local `getdotenv.config.json` in
 * projects that import the CLI.
 */
interface GetDotenvCliGenerateOptions extends GetDotenvCliOptions {
    /**
     * CLI alias. Should align with the `bin` property in `package.json`.
     */
    alias: string;
    /**
     * Cli description (appears in CLI help).
     */
    description: string;
    /**
     * The `import.meta.url` of the module generating the CLI.
     */
    importMetaUrl: string;
    /**
     * Logger object (defaults to console)
     */
    logger: Logger;
    /**
     * Mutates inbound options & executes side effects within the `getDotenv`
     * context before executing CLI commands.
     */
    preHook?: GetDotenvCliPreHookCallback;
    /**
     * Executes side effects within the `getDotenv` context after executing CLI
     * commands.
     */
    postHook?: GetDotenvCliPostHookCallback;
}

/**
 * Generate a Commander CLI Command for get-dotenv.
 * Orchestration only: delegates building and lifecycle hooks.
 */
declare const generateGetDotenvCli: (customOptions: Pick<GetDotenvCliGenerateOptions, "importMetaUrl"> & Partial<Omit<GetDotenvCliGenerateOptions, "importMetaUrl">>) => Promise<Command>;

/**
 * Asynchronously process dotenv files of the form `.env[.<ENV>][.<PRIVATE_TOKEN>]`
 *
 * @param options - `GetDotenvOptions` object
 * @returns The combined parsed dotenv object.
 * * @example Load from the project root with default tokens
 * ```ts
 * const vars = await getDotenv();
 * console.log(vars.MY_SETTING);
 * ```
 *
 * @example Load from multiple paths and a specific environment
 * ```ts
 * const vars = await getDotenv({
 *   env: 'dev',
 *   dotenvToken: '.testenv',
 *   privateToken: 'secret',
 *   paths: ['./', './packages/app'],
 * });
 * ```
 *
 * @example Use dynamic variables
 * ```ts
 * // .env.js default-exports: { DYNAMIC: ({ PREV }) => `${PREV}-suffix` }
 * const vars = await getDotenv({ dynamicPath: '.env.js' });
 * ```
 *
 * @remarks
 * - When {@link GetDotenvOptions.loadProcess} is true, the resulting variables are merged
 *   into `process.env` as a side effect.
 * - When {@link GetDotenvOptions.outputPath} is provided, a consolidated dotenv file is written.
 *   The path is resolved after expansion, so it may reference previously loaded vars.
 *
 * @throws Error when a dynamic module is present but cannot be imported.
 * @throws Error when an output path was requested but could not be resolved.
 */
declare const getDotenv: (options?: Partial<GetDotenvOptions>) => Promise<ProcessEnv>;

/**
 * Deeply interpolate string leaves against envRef.
 * Arrays are not recursed into; they are returned unchanged.
 *
 * @typeParam T - Shape of the input value.
 * @param value - Input value (object/array/primitive).
 * @param envRef - Reference environment for interpolation.
 * @returns A new value with string leaves interpolated.
 */
declare const interpolateDeep: <T>(value: T, envRef: ProcessEnv) => T;

/**
 * Create a get-dotenv CLI host with included plugins.
 *
 * Options:
 * - alias: command name used for help/argv scaffolding (default: "getdotenv")
 * - branding: optional help header; when omitted, brand() uses "<alias> v<version>"
 *
 * Usage:
 *   import \{ createCli \} from '\@karmaniverous/get-dotenv';
 *   await createCli(\{ alias: 'getdotenv', branding: 'getdotenv vX.Y.Z' \})
 *     .run(process.argv.slice(2));
 */
type CreateCliOptions = {
    alias?: string;
    branding?: string;
};
declare function createCli(opts?: CreateCliOptions): {
    run: (argv: string[]) => Promise<void>;
};

export { buildSpawnEnv, createCli, defineDynamic, dotenvExpand, dotenvExpandAll, dotenvExpandFromProcessEnv, generateGetDotenvCli, getDotenv, getDotenvCliOptions2Options, interpolateDeep };
export type { CreateCliOptions, GetDotenvDynamic, GetDotenvOptions, ProcessEnv };
