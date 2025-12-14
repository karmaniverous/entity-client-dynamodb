import { z, ZodObject } from 'zod';
export { z } from 'zod';
import { OptionValues, Command, InferCommandArguments, Option, CommandUnknownOpts } from '@commander-js/extra-typings';

/**
 * Minimal root options shape shared by CLI and generator layers.
 * Keep keys optional to respect exactOptionalPropertyTypes semantics.
 *
 * @public
 */
interface RootOptionsShape {
    /** Target environment (dotenv-expanded). */
    env?: string;
    /** Explicit variable overrides (dotenv-expanded). */
    vars?: string;
    /** Command to execute (dotenv-expanded). */
    command?: string;
    /** Output path for the consolidated environment file (dotenv-expanded). */
    outputPath?: string;
    /**
     * Shell execution strategy.
     * - `true`: use default OS shell.
     * - `false`: use plain execution (no shell).
     * - string: use specific shell path.
     */
    shell?: string | boolean;
    /** Whether to load variables into `process.env`. */
    loadProcess?: boolean;
    /** Exclude all variables from loading. */
    excludeAll?: boolean;
    /** Exclude dynamic variables. */
    excludeDynamic?: boolean;
    /** Exclude environment-specific variables. */
    excludeEnv?: boolean;
    /** Exclude global variables. */
    excludeGlobal?: boolean;
    /** Exclude private variables. */
    excludePrivate?: boolean;
    /** Exclude public variables. */
    excludePublic?: boolean;
    /** Enable console logging of loaded variables. */
    log?: boolean;
    /** Enable debug logging to stderr. */
    debug?: boolean;
    /** Capture child process stdio (useful for tests/CI). */
    capture?: boolean;
    /** Fail on validation errors (schema/requiredKeys). */
    strict?: boolean;
    /** Enable presentation-time redaction of secret-like keys. */
    redact?: boolean;
    /** Enable entropy warnings for high-entropy values. */
    warnEntropy?: boolean;
    /** Entropy threshold (bits/char) for warnings (default 3.8). */
    entropyThreshold?: number;
    /** Minimum string length to check for entropy (default 16). */
    entropyMinLength?: number;
    /** Regex patterns for keys to exclude from entropy checks. */
    entropyWhitelist?: ReadonlyArray<string>;
    /** Additional regex patterns for keys to redact. */
    redactPatterns?: string[];
    /** Default target environment when not specified. */
    defaultEnv?: string;
    /** Token indicating a dotenv file (default: ".env"). */
    dotenvToken?: string;
    /** Path to dynamic variables module (default: undefined). */
    dynamicPath?: string;
    /**
     * Emit diagnostics for child env composition.
     * - `true`: trace all keys.
     * - `string[]`: trace selected keys.
     */
    trace?: boolean | string[];
    /** Paths to search for dotenv files (space-delimited string or array). */
    paths?: string;
    /** Delimiter for paths string (default: space). */
    pathsDelimiter?: string;
    /** Regex pattern for paths delimiter. */
    pathsDelimiterPattern?: string;
    /** Token indicating private variables (default: "local"). */
    privateToken?: string;
    /** Delimiter for vars string (default: space). */
    varsDelimiter?: string;
    /** Regex pattern for vars delimiter. */
    varsDelimiterPattern?: string;
    /** Assignment operator for vars (default: "="). */
    varsAssignor?: string;
    /** Regex pattern for vars assignment operator. */
    varsAssignorPattern?: string;
    /** Table of named scripts for execution. */
    scripts?: ScriptsTable;
}
/**
 * Definition for a single script entry.
 */
interface ScriptDef<TShell extends string | boolean = string | boolean> {
    /** The command string to execute. */
    cmd: string;
    /** Shell override for this script. */
    shell?: TShell | undefined;
}
/**
 * Scripts table shape.
 */
type ScriptsTable<TShell extends string | boolean = string | boolean> = Record<string, string | ScriptDef<TShell>>;
/**
 * Identity helper to define a scripts table while preserving a concrete TShell
 * type parameter in downstream inference.
 */
declare const defineScripts: <TShell extends string | boolean>() => <T extends ScriptsTable<TShell>>(t: T) => T;
/**
 * Per-invocation context shared with plugins and actions.
 *
 * @public
 */
interface GetDotenvCliCtx<TOptions extends GetDotenvOptions = GetDotenvOptions> {
    optionsResolved: TOptions;
    dotenv: ProcessEnv;
    plugins?: Record<string, unknown>;
    pluginConfigs?: Record<string, unknown>;
}
/**
 * Options for branding the CLI.
 *
 * @public
 */
interface BrandOptions {
    /** CLI name. */
    name?: string;
    /** CLI description. */
    description?: string;
    /** CLI version string. */
    version?: string;
    /** Import URL for resolving package version. */
    importMetaUrl?: string;
    /** Custom help header text. */
    helpHeader?: string;
}

/**
 * Resolved CLI options schema.
 * For the current step this mirrors the RAW schema; later stages may further
 * narrow types post-resolution in the host pipeline.
 */
declare const getDotenvCliOptionsSchemaResolved: z.ZodObject<{
    defaultEnv: z.ZodOptional<z.ZodString>;
    dotenvToken: z.ZodOptional<z.ZodString>;
    dynamicPath: z.ZodOptional<z.ZodString>;
    dynamic: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    env: z.ZodOptional<z.ZodString>;
    excludeDynamic: z.ZodOptional<z.ZodBoolean>;
    excludeEnv: z.ZodOptional<z.ZodBoolean>;
    excludeGlobal: z.ZodOptional<z.ZodBoolean>;
    excludePrivate: z.ZodOptional<z.ZodBoolean>;
    excludePublic: z.ZodOptional<z.ZodBoolean>;
    loadProcess: z.ZodOptional<z.ZodBoolean>;
    log: z.ZodOptional<z.ZodBoolean>;
    logger: z.ZodDefault<z.ZodUnknown>;
    outputPath: z.ZodOptional<z.ZodString>;
    privateToken: z.ZodOptional<z.ZodString>;
    debug: z.ZodOptional<z.ZodBoolean>;
    strict: z.ZodOptional<z.ZodBoolean>;
    capture: z.ZodOptional<z.ZodBoolean>;
    trace: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
    redact: z.ZodOptional<z.ZodBoolean>;
    warnEntropy: z.ZodOptional<z.ZodBoolean>;
    entropyThreshold: z.ZodOptional<z.ZodNumber>;
    entropyMinLength: z.ZodOptional<z.ZodNumber>;
    entropyWhitelist: z.ZodOptional<z.ZodArray<z.ZodString>>;
    redactPatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
    paths: z.ZodOptional<z.ZodString>;
    pathsDelimiter: z.ZodOptional<z.ZodString>;
    pathsDelimiterPattern: z.ZodOptional<z.ZodString>;
    scripts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    shell: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>;
    vars: z.ZodOptional<z.ZodString>;
    varsAssignor: z.ZodOptional<z.ZodString>;
    varsAssignorPattern: z.ZodOptional<z.ZodString>;
    varsDelimiter: z.ZodOptional<z.ZodString>;
    varsDelimiterPattern: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;

/**
 * Resolved programmatic options schema (post-inheritance).
 * For now, this mirrors the RAW schema; future stages may materialize defaults
 * and narrow shapes as resolution is wired into the host.
 */
declare const getDotenvOptionsSchemaResolved: z.ZodObject<{
    defaultEnv: z.ZodOptional<z.ZodString>;
    dotenvToken: z.ZodOptional<z.ZodString>;
    dynamicPath: z.ZodOptional<z.ZodString>;
    dynamic: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    env: z.ZodOptional<z.ZodString>;
    excludeDynamic: z.ZodOptional<z.ZodBoolean>;
    excludeEnv: z.ZodOptional<z.ZodBoolean>;
    excludeGlobal: z.ZodOptional<z.ZodBoolean>;
    excludePrivate: z.ZodOptional<z.ZodBoolean>;
    excludePublic: z.ZodOptional<z.ZodBoolean>;
    loadProcess: z.ZodOptional<z.ZodBoolean>;
    log: z.ZodOptional<z.ZodBoolean>;
    logger: z.ZodDefault<z.ZodUnknown>;
    outputPath: z.ZodOptional<z.ZodString>;
    paths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    privateToken: z.ZodOptional<z.ZodString>;
    vars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodOptional<z.ZodString>>>;
}, z.core.$strip>;

/**
 * Canonical programmatic options and helpers for get-dotenv.
 *
 * Requirements addressed:
 * - GetDotenvOptions derives from the Zod schema output (single source of truth).
 * - Removed deprecated/compat flags from the public shape (e.g., useConfigLoader).
 * - Provide Vars-aware defineDynamic and a typed config builder defineGetDotenvConfig\<Vars, Env\>().
 * - Preserve existing behavior for defaults resolution and compat converters.
 */

/**
 * Compatibility shape for root options allowing string inputs for vars/paths.
 * Used during CLI argument parsing before normalization.
 */
type RootOptionsShapeCompat = Omit<RootOptionsShape, 'vars' | 'paths'> & {
    /**
     * Extra variables as either a space‑delimited string of assignments
     * (e.g., `"FOO=1 BAR=2"`) or an object map of `string | undefined` values.
     */
    vars?: string | Record<string, string | undefined>;
    /**
     * Dotenv search paths as a space‑delimited string or a pre‑split string[].
     */
    paths?: string | string[];
};
/**
 * A minimal representation of an environment key/value mapping.
 * Values may be `undefined` to represent "unset".
 */
type ProcessEnv = Record<string, string | undefined>;
/**
 * Dynamic variable function signature. Receives the current expanded variables
 * and the selected environment (if any), and returns either a string to set
 * or `undefined` to unset/skip the variable.
 */
type GetDotenvDynamicFunction = (vars: ProcessEnv, env: string | undefined) => string | undefined;
/**
 * A map of dynamic variable definitions.
 * Keys are variable names; values are either literal strings or functions.
 */
type GetDotenvDynamic = Record<string, GetDotenvDynamicFunction | ReturnType<GetDotenvDynamicFunction>>;
/**
 * Logger interface compatible with `console` or a subset thereof.
 */
type Logger = Record<string, (...args: unknown[]) => void> | typeof console;
/**
 * Canonical programmatic options type (schema-derived).
 * This type is the single source of truth for programmatic options.
 */
type GetDotenvOptions = z.output<typeof getDotenvOptionsSchemaResolved> & {
    /**
     * Compile-time overlay: narrowed logger for DX (schema stores unknown).
     */
    logger: Logger;
    /**
     * Compile-time overlay: narrowed dynamic map for DX (schema stores unknown).
     */
    dynamic?: GetDotenvDynamic;
};
/**
 * Vars-aware dynamic helpers (compile-time DX).
 * DynamicFn: receive the current expanded variables and optional env.
 */
type DynamicFn<Vars extends Record<string, string | undefined>> = (vars: Vars, env?: string) => string | undefined;
type DynamicMap<Vars extends Record<string, string | undefined>> = Record<string, DynamicFn<Vars> | ReturnType<DynamicFn<Vars>>>;
/**
 * Helper to define a dynamic map with strong inference (Vars-aware).
 *
 * Overload A (preferred): bind Vars to your intended key set for improved inference.
 */
declare function defineDynamic<Vars extends Record<string, string | undefined>, T extends DynamicMap<Vars>>(d: T): T;
/**
 * Overload B (backward-compatible): generic over legacy GetDotenvDynamic.
 *
 * Accepts legacy GetDotenvDynamic without Vars binding.
 */
declare function defineDynamic<T extends GetDotenvDynamic>(d: T): T;
/**
 * Typed config shape and builder for authoring JS/TS getdotenv config files.
 *
 * Compile-time only; the runtime loader remains schema-driven.
 */
interface GetDotenvConfig<Vars extends ProcessEnv, Env extends string = string> {
    /**
     * Operational root defaults applied by the host (collapsed families; stringly form).
     */
    rootOptionDefaults?: Partial<RootOptionsShape>;
    /** Token indicating a dotenv file. */
    dotenvToken?: string;
    /** Token indicating private variables. */
    privateToken?: string;
    /** Paths to search for dotenv files. */
    paths?: string | string[];
    /** Whether to load variables into `process.env`. */
    loadProcess?: boolean;
    /** Whether to log loaded variables. */
    log?: boolean;
    /** Shell execution strategy. */
    shell?: string | boolean;
    /** Scripts table. */
    scripts?: ScriptsTable;
    /** Keys required to be present in the final environment. */
    requiredKeys?: string[];
    /** Validation schema (e.g. Zod). */
    schema?: unknown;
    /** Global variables. */
    vars?: Vars;
    /** Environment-specific variables. */
    envVars?: Record<Env, Partial<Vars>>;
    /** Dynamic variable definitions. */
    dynamic?: DynamicMap<Vars>;
    /** Plugin configuration slices. */
    plugins?: Record<string, unknown>;
}
/**
 * Define a strongly‑typed get‑dotenv configuration document for JS/TS authoring.
 *
 * This helper is compile‑time only: it returns the input unchanged at runtime,
 * but enables rich TypeScript inference for `vars`, `envVars`, and `dynamic`,
 * and validates property names and value shapes as you author the config.
 *
 * @typeParam Vars - The string‑valued env map your project uses (for example,
 *   `{ APP_SETTING?: string }`). Keys propagate to `dynamic` function arguments.
 * @typeParam Env - Allowed environment names used for `envVars` (defaults to `string`).
 * @typeParam T - The full config type being produced (defaults to `GetDotenvConfig<Vars, Env>`).
 *   This type parameter is rarely supplied explicitly.
 * @param cfg - The configuration object literal.
 * @returns The same `cfg` value, with its type preserved for inference.
 */
declare function defineGetDotenvConfig<Vars extends ProcessEnv, Env extends string = string, T extends GetDotenvConfig<Vars, Env> = GetDotenvConfig<Vars, Env>>(cfg: T): T;
/**
 * Compile-time helper to derive the Vars shape from a typed getdotenv config document.
 */
type InferGetDotenvVarsFromConfig<T> = T extends {
    vars?: infer V;
} ? V extends Record<string, string | undefined> ? V : never : never;
/**
 * Converts programmatic CLI options to `getDotenv` options.
 *
 * Accepts "stringly" CLI inputs for vars/paths and normalizes them into
 * the programmatic shape. Preserves exactOptionalPropertyTypes semantics by
 * omitting keys when undefined.
 */
declare const getDotenvCliOptions2Options: ({ paths, pathsDelimiter, pathsDelimiterPattern, vars, varsAssignor, varsAssignorPattern, varsDelimiter, varsDelimiterPattern, debug: _debug, scripts: _scripts, ...rest }: RootOptionsShapeCompat) => GetDotenvOptions;

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
 * - When {@link GetDotenvOptions | loadProcess} is true, the resulting variables are merged
 *   into `process.env` as a side effect.
 * - When {@link GetDotenvOptions | outputPath} is provided, a consolidated dotenv file is written.
 *   The path is resolved after expansion, so it may reference previously loaded vars.
 *
 * @throws Error when a dynamic module is present but cannot be imported.
 * @throws Error when an output path was requested but could not be resolved.
 */
declare function getDotenv<Vars extends ProcessEnv = ProcessEnv>(options?: Partial<GetDotenvOptions>): Promise<Vars>;
declare function getDotenv<Vars extends ProcessEnv>(options: Partial<GetDotenvOptions> & {
    vars: Vars;
}): Promise<ProcessEnv & Vars>;

/**
 * Unify Scripts via the generic ScriptsTable<TShell> so shell types propagate.
 */
type Scripts = ScriptsTable;
/**
 * Canonical CLI options type derived from the Zod schema output.
 * Includes CLI-only flags (debug/strict/capture/trace/redaction/entropy),
 * stringly paths/vars, and inherited programmatic fields (minus normalized
 * shapes that are handled by resolution).
 */
type GetDotenvCliOptions = z.output<typeof getDotenvCliOptionsSchemaResolved> & {
    /**
     * Compile-only overlay for DX: logger narrowed from unknown.
     */
    logger: Logger;
    /**
     * Compile-only overlay for DX: scripts narrowed from Record\<string, unknown\>.
     */
    scripts?: Scripts;
};

/**
 * Configuration context used for generating dynamic help descriptions.
 * Contains merged CLI options and plugin configuration slices.
 *
 * @public
 */
type ResolvedHelpConfig = Partial<GetDotenvCliOptions> & {
    /**
     * Per‑plugin configuration slices keyed by realized mount path
     * (e.g., `"aws"` or `"aws/whoami"`), used for dynamic help text.
     */
    plugins: Record<string, unknown>;
};

/** src/cliHost/definePlugin/contracts.ts
 * Public contracts for plugin authoring (types only).
 * - No runtime logic or state.
 * - Safe to import broadly without introducing cycles.
 */

/**
 * Options for resolving and loading the configuration.
 *
 * @public
 */
interface ResolveAndLoadOptions {
    /**
     * When false, skips running plugin afterResolve hooks.
     * Useful for top-level help rendering to avoid long-running side-effects
     * while still evaluating dynamic help text.
     *
     * @default true
     */
    runAfterResolve?: boolean;
}
/**
 * Structural public interface for the host exposed to plugins.
 * - Extends Commander.Command so plugins can attach options/commands/hooks.
 * - Adds host-specific helpers used by built-in plugins.
 *
 * Purpose: remove nominal class identity (private fields) from the plugin seam
 * to avoid TS2379 under exactOptionalPropertyTypes in downstream consumers.
 */
interface GetDotenvCliPublic<TOptions extends GetDotenvOptions = GetDotenvOptions, TArgs extends unknown[] = [], TOpts extends OptionValues = {}, TGlobal extends OptionValues = {}> extends Command<TArgs, TOpts, TGlobal> {
    /**
     * Create a namespaced child command with argument inference.
     * Mirrors Commander generics so downstream chaining remains fully typed.
     */
    ns<Usage extends string>(name: Usage): GetDotenvCliPublic<TOptions, [
        ...TArgs,
        ...InferCommandArguments<Usage>
    ], {}, TOpts & TGlobal>;
    /** Return the current context; throws if not yet resolved. */
    getCtx(): GetDotenvCliCtx<TOptions>;
    /** Check whether a context has been resolved (non-throwing). */
    hasCtx(): boolean;
    resolveAndLoad(customOptions?: Partial<TOptions>, opts?: ResolveAndLoadOptions): Promise<GetDotenvCliCtx<TOptions>>;
    setOptionGroup(opt: Option, group: string): void;
    /**
     * Create a dynamic option whose description is computed at help time
     * from the resolved configuration.
     */
    createDynamicOption<Usage extends string>(flags: Usage, desc: (cfg: ResolvedHelpConfig) => string, parser?: (value: string, previous?: unknown) => unknown, defaultValue?: unknown): Option<Usage>;
    createDynamicOption<Usage extends string, TValue = unknown>(flags: Usage, desc: (cfg: ResolvedHelpConfig) => string, parser: (value: string, previous?: TValue) => TValue, defaultValue?: TValue): Option<Usage>;
}
/**
 * Optional overrides for plugin composition.
 *
 * @public
 */
interface PluginNamespaceOverride {
    /**
     * Override the default namespace for this plugin instance.
     */
    ns?: string;
}
/**
 * An entry in the plugin children array.
 *
 * @public
 */
interface PluginChildEntry<TOptions extends GetDotenvOptions = GetDotenvOptions, TArgs extends unknown[] = [], TOpts extends OptionValues = {}, TGlobal extends OptionValues = {}> {
    /** The child plugin instance to mount under this parent. */
    plugin: GetDotenvCliPlugin<TOptions, TArgs, TOpts, TGlobal>;
    /**
     * Optional namespace override for the child when mounted under the parent.
     * When provided, this name is used instead of the child's default `ns`.
     */
    override: PluginNamespaceOverride | undefined;
}
/** Public plugin contract used by the GetDotenv CLI host. */
interface GetDotenvCliPlugin<TOptions extends GetDotenvOptions = GetDotenvOptions, TArgs extends unknown[] = [], TOpts extends OptionValues = {}, TGlobal extends OptionValues = {}> {
    /** Namespace (required): the command name where this plugin is mounted. */
    ns: string;
    /**
     * Setup phase: register commands and wiring on the provided mount.
     * Runs parent → children (pre-order). Return nothing (void).
     */
    setup: (cli: GetDotenvCliPublic<TOptions, TArgs, TOpts, TGlobal>) => void | Promise<void>;
    /**
     * After the dotenv context is resolved, initialize any clients/secrets
     * or attach per-plugin state under ctx.plugins (by convention).
     * Runs parent → children (pre-order).
     */
    afterResolve?: (cli: GetDotenvCliPublic<TOptions, TArgs, TOpts, TGlobal>, ctx: GetDotenvCliCtx<TOptions>) => void | Promise<void>;
    /** Zod schema for this plugin's config slice (from config.plugins[…]). */
    configSchema?: ZodObject;
    /**
     * Compositional children, with optional per-child overrides (e.g., ns).
     * Installed after the parent per pre-order.
     */
    children: Array<PluginChildEntry<TOptions, TArgs, TOpts, TGlobal>>;
    /**
     * Compose a child plugin with optional override (ns). Returns the parent
     * to enable chaining.
     */
    use: (child: GetDotenvCliPlugin<TOptions, TArgs, TOpts, TGlobal>, override?: PluginNamespaceOverride) => GetDotenvCliPlugin<TOptions, TArgs, TOpts, TGlobal>;
}
/**
 * Compile-time helper type: the plugin object returned by definePlugin always
 * includes the instance-bound helpers as required members. Keeping the public
 * interface optional preserves compatibility for ad-hoc/test plugins, while
 * return types from definePlugin provide stronger DX for shipped/typed plugins.
 */
interface PluginWithInstanceHelpers<TOptions extends GetDotenvOptions = GetDotenvOptions, TConfig = unknown, TArgs extends unknown[] = [], TOpts extends OptionValues = {}, TGlobal extends OptionValues = {}> extends GetDotenvCliPlugin<TOptions, TArgs, TOpts, TGlobal> {
    readConfig<TCfg = TConfig>(cli: GetDotenvCliPublic<TOptions, unknown[], OptionValues, OptionValues>): Readonly<TCfg>;
    createPluginDynamicOption<TCfg = TConfig, Usage extends string = string>(cli: GetDotenvCliPublic<TOptions, unknown[], OptionValues, OptionValues>, flags: Usage, desc: (cfg: ResolvedHelpConfig, pluginCfg: Readonly<TCfg>) => string, parser?: (value: string, previous?: unknown) => unknown, defaultValue?: unknown): Option<Usage>;
}
/**
 * Public spec type for defining a plugin with compositional helpers.
 */
type DefineSpec<TOptions extends GetDotenvOptions = GetDotenvOptions, TArgs extends unknown[] = [], TOpts extends OptionValues = {}, TGlobal extends OptionValues = {}> = Omit<GetDotenvCliPlugin<TOptions, TArgs, TOpts, TGlobal>, 'children' | 'use' | 'setup'> & {
    /**
     * Required namespace and setup function. The host creates the mount and
     * passes it into setup; return void | Promise<void>.
     */
    ns: string;
    setup: (cli: GetDotenvCliPublic<TOptions, TArgs, TOpts, TGlobal>) => void | Promise<void>;
};
/**
 * Helper to infer the configuration type from a `PluginWithInstanceHelpers` type.
 */
type InferPluginConfig<P> = P extends PluginWithInstanceHelpers<GetDotenvOptions, infer C> ? Readonly<C> : never;

/**
 * Define a GetDotenv CLI plugin with compositional helpers.
 *
 * @example
 * const p = definePlugin(\{ ns: 'aws', setup(cli) \{ /* wire subcommands *\/ \} \})
 *   .use(child, \{ ns: 'whoami' \});
 */
declare function definePlugin<TOptions extends GetDotenvOptions, Schema extends ZodObject>(spec: Omit<DefineSpec<TOptions>, 'configSchema'> & {
    configSchema: Schema;
}): PluginWithInstanceHelpers<TOptions, z.output<Schema>>;
declare function definePlugin<TOptions extends GetDotenvOptions>(spec: DefineSpec<TOptions>): PluginWithInstanceHelpers<TOptions, {}>;

/**
 * Helper to decide whether to capture child stdio.
 * Checks GETDOTENV_STDIO env var or the provided bag capture flag.
 */
declare const shouldCapture: (bagCapture?: boolean) => boolean;

/** src/cliHost/GetDotenvCli.ts
 * Plugin-first CLI host for get-dotenv with Commander generics preserved.
 * Public surface implements GetDotenvCliPublic and provides:
 *  - attachRootOptions (builder-only; no public override wiring)
 *  - resolveAndLoad (strict resolve + context compute)
 *  - getCtx/hasCtx accessors
 *  - ns() for typed subcommand creation with duplicate-name guard
 *  - grouped help rendering with dynamic option descriptions
 */

declare const CTX_SYMBOL: unique symbol;
declare const OPTS_SYMBOL: unique symbol;
declare const HELP_HEADER_SYMBOL: unique symbol;
/**
 * Plugin-first CLI host for get-dotenv. Extends Commander.Command.
 *
 * Responsibilities:
 * - Resolve options strictly and compute dotenv context (resolveAndLoad).
 * - Expose a stable accessor for the current context (getCtx).
 * - Provide a namespacing helper (ns).
 * - Support composable plugins with parent → children install and afterResolve.
 */
declare class GetDotenvCli<TOptions extends GetDotenvOptions = GetDotenvOptions, TArgs extends unknown[] = [], TOpts extends OptionValues = {}, TGlobal extends OptionValues = {}> extends Command<TArgs, TOpts, TGlobal> implements GetDotenvCliPublic<TOptions, TArgs, TOpts, TGlobal> {
    /** Registered top-level plugins (composition happens via .use()) */
    private _plugins;
    /** One-time installation guard */
    private _installed;
    /** In-flight installation promise to guard against concurrent installs */
    private _installing?;
    /** Optional header line to prepend in help output */
    private [HELP_HEADER_SYMBOL];
    /** Context/options stored under symbols (typed) */
    private [CTX_SYMBOL]?;
    private [OPTS_SYMBOL]?;
    /**
     * Create a subcommand using the same subclass, preserving helpers like
     * dynamicOption on children.
     */
    createCommand(name?: string): GetDotenvCli<TOptions>;
    constructor(alias?: string);
    /**
     * Attach legacy/base root flags to this CLI instance.
     * Delegates to the pure builder in attachRootOptions.ts.
     */
    attachRootOptions(defaults?: Partial<RootOptionsShape>): this;
    /**
     * Resolve options (strict) and compute dotenv context.
     * Stores the context on the instance under a symbol.
     *
     * Options:
     * - opts.runAfterResolve (default true): when false, skips running plugin
     *   afterResolve hooks. Useful for top-level help rendering to avoid
     *   long-running side-effects while still evaluating dynamic help text.
     */
    resolveAndLoad(customOptions?: Partial<TOptions>, opts?: ResolveAndLoadOptions): Promise<GetDotenvCliCtx<TOptions>>;
    /**
     * Create a Commander Option that computes its description at help time.
     * The returned Option may be configured (conflicts, default, parser) and
     * added via addOption().
     */
    createDynamicOption<Usage extends string>(flags: Usage, desc: (cfg: ResolvedHelpConfig) => string, parser?: (value: string, previous?: unknown) => unknown, defaultValue?: unknown): Option<Usage>;
    createDynamicOption<Usage extends string, TValue = unknown>(flags: Usage, desc: (cfg: ResolvedHelpConfig) => string, parser: (value: string, previous?: TValue) => TValue, defaultValue?: TValue): Option<Usage>;
    /**
     * Evaluate dynamic descriptions for this command and all descendants using
     * the provided resolved configuration. Mutates the Option.description in
     * place so Commander help renders updated text.
     */
    evaluateDynamicOptions(resolved: ResolvedHelpConfig): void;
    /** Internal: climb to the true root (host) command. */
    private _root;
    /**
     * Retrieve the current invocation context (if any).
     */
    getCtx(): GetDotenvCliCtx<TOptions>;
    /**
     * Check whether a context has been resolved (non-throwing guard).
     */
    hasCtx(): boolean;
    /**
     * Retrieve the merged root CLI options bag (if set by passOptions()).
     * Downstream-safe: no generics required.
     */
    getOptions(): GetDotenvCliOptions | undefined;
    /** Internal: set the merged root options bag for this run. */
    _setOptionsBag(bag: GetDotenvCliOptions): void;
    /**
     * Convenience helper to create a namespaced subcommand with argument inference.
     * This mirrors Commander generics so downstream chaining stays fully typed.
     */
    ns<Usage extends string>(name: Usage): GetDotenvCliPublic<TOptions, [
        ...TArgs,
        ...InferCommandArguments<Usage>
    ], {}, TOpts & TGlobal>;
    /**
     * Tag options added during the provided callback as 'app' for grouped help.
     * Allows downstream apps to demarcate their root-level options.
     */
    tagAppOptions<T>(fn: (root: CommandUnknownOpts) => T): T;
    /**
     * Branding helper: set CLI name/description/version and optional help header.
     * If version is omitted and importMetaUrl is provided, attempts to read the
     * nearest package.json version (best-effort; non-fatal on failure).
     */
    brand(args: BrandOptions): Promise<this>;
    /**
     * Insert grouped plugin/app options between "Options" and "Commands" for
     * hybrid ordering. Applies to root and any parent command.
     */
    helpInformation(): string;
    /**
     * Public: tag an Option with a display group for help (root/app/plugin:<id>).
     */
    setOptionGroup(opt: Option, group: string): void;
    /**
     * Register a plugin for installation (parent level).
     * Installation occurs on first resolveAndLoad() (or explicit install()).
     */
    use(plugin: GetDotenvCliPlugin<TOptions, TArgs, TOpts, TGlobal>, override?: PluginNamespaceOverride): this;
    /**
     * Install all registered plugins in parent → children (pre-order).
     * Runs only once per CLI instance.
     */
    install(): Promise<void>;
    /**
     * Run afterResolve hooks for all plugins (parent → children).
     */
    private _runAfterResolve;
}

/**
 * Retrieve the merged root options bag from the current command context.
 * Climbs to the root `GetDotenvCli` instance to access the persisted options.
 *
 * @param cmd - The current command instance (thisCommand).
 * @throws Error if the root is not a GetDotenvCli or options are missing.
 */
declare const readMergedOptions: (cmd: CommandUnknownOpts) => GetDotenvCliOptions;

/**
 * Build a sanitized environment object for spawning child processes.
 * Merges `base` and `overlay`, drops undefined values, and handles platform-specific
 * normalization (e.g. case-insensitivity on Windows).
 *
 * @param base - Base environment (usually `process.env`).
 * @param overlay - Environment variables to overlay.
 */
declare const buildSpawnEnv: (base?: NodeJS.ProcessEnv, overlay?: Record<string, string | undefined>) => NodeJS.ProcessEnv;

/**
 * Create a get-dotenv CLI host with included plugins.
 *
 * Options:
 * - alias: command name used for help/argv scaffolding (default: "getdotenv")
 * - branding: optional help header; when omitted, brand() uses "<alias> v<version>"
 *
 * Usage:
 * ```ts
 * import { createCli } from '@karmaniverous/get-dotenv';
 *
 * await createCli({
 *    alias: 'getdotenv',
 *    branding: 'getdotenv vX.Y.Z'
 * })();
 * ```
 */
type CreateCliOptions = {
    /**
     * CLI command name used for help and argv scaffolding.
     * Defaults to `'getdotenv'` when omitted.
     */
    alias?: string;
    /**
     * Optional help header text. When omitted, brand() uses
     * `"<alias> v<resolved-version>"` if a version can be read.
     */
    branding?: string;
    /**
     * Optional composer to wire the CLI (plugins/options). If not provided,
     * the shipped default wiring is applied. Any `configureOutput`/`exitOverride`
     * you call here override the defaults.
     */
    compose?: (program: GetDotenvCli) => GetDotenvCli;
    /**
     * Root defaults applied once before composition. These are used by flag declaration
     * and merge-time defaults (and top-level -h parity labels).
     * Note: shipped CLI does not force loadProcess OFF; base defaults apply unless set here.
     */
    rootOptionDefaults?: Partial<RootOptionsShape>;
    /**
     * Visibility map to hide families/singles from root help. When a key is false,
     * the corresponding option(s) are hidden (via hideHelp) after flags are declared.
     */
    rootOptionVisibility?: Partial<Record<keyof RootOptionsShape, boolean>>;
};
/**
 * Create a configured get-dotenv CLI host.
 * Applies defaults, installs root hooks, and composes plugins.
 * Returns a runner function that accepts an argv array.
 */
declare function createCli(opts?: CreateCliOptions): (argv?: string[]) => Promise<void>;

/**
 * Base root CLI defaults (shared; kept untyped here to avoid cross-layer deps).
 * Used as the bottom layer for CLI option resolution.
 */
/**
 * Default values for root CLI options used by the host and helpers as the
 * baseline layer during option resolution.
 *
 * These defaults correspond to the "stringly" root surface (see `RootOptionsShape`)
 * and are merged by precedence with create-time overrides and any discovered
 * configuration `rootOptionDefaults` before CLI flags are applied.
 */
declare const baseRootOptionDefaults: {
    readonly dotenvToken: ".env";
    readonly loadProcess: true;
    readonly logger: Console;
    readonly warnEntropy: true;
    readonly entropyThreshold: 3.8;
    readonly entropyMinLength: 16;
    readonly entropyWhitelist: readonly ["^GIT_", "^npm_", "^CI$", "SHLVL"];
    readonly paths: "./";
    readonly pathsDelimiter: " ";
    readonly privateToken: "local";
    readonly scripts: {
        readonly 'git-status': {
            readonly cmd: "git branch --show-current && git status -s -u";
            readonly shell: true;
        };
    };
    readonly shell: true;
    readonly vars: "";
    readonly varsAssignor: "=";
    readonly varsDelimiter: " ";
};

/**
 * Configuration options for entropy analysis.
 *
 * @public
 */
interface EntropyOptions {
    /** Enable entropy warnings. */
    warnEntropy?: boolean;
    /** Entropy threshold (bits/char). */
    entropyThreshold?: number;
    /** Minimum string length to check. */
    entropyMinLength?: number;
    /** Whitelist of regex patterns to ignore. */
    entropyWhitelist?: Array<string | RegExp>;
}
/**
 * Maybe emit a one-line entropy warning for a key.
 * Caller supplies an `emit(line)` function; the helper ensures once-per-key.
 */
declare const maybeWarnEntropy: (key: string, value: string | undefined, origin: "dotenv" | "parent" | "unset", opts: EntropyOptions | undefined, emit: (line: string) => void) => void;

/** src/diagnostics/redact.ts
 * Presentation-only redaction utilities for logs/trace.
 * - Default secret-like key patterns: SECRET, TOKEN, PASSWORD, API_KEY, KEY
 * - Optional custom patterns (regex strings) may be provided.
 * - Never alters runtime env; only affects displayed values.
 */

/**
 * Configuration options for secret redaction.
 *
 * @public
 */
interface RedactOptions {
    /** Enable redaction. */
    redact?: boolean;
    /** Regex patterns for keys to redact. */
    redactPatterns?: Array<string | RegExp>;
}
/**
 * Redact a single displayed value according to key/patterns.
 * Returns the original value when redaction is disabled or key is not matched.
 */
declare const redactDisplay: (key: string, value: string | undefined, opts?: RedactOptions) => string | undefined;
/**
 * Produce a shallow redacted copy of an env-like object for display.
 */
declare const redactObject: (obj: ProcessEnv, opts?: RedactOptions) => Record<string, string | undefined>;

/**
 * Options for tracing composed child environment variables.
 *
 * Presentation-only: values are never mutated; output is written to {@link write}.
 *
 * @public
 */
interface TraceChildEnvOptions extends Pick<RedactOptions, 'redact' | 'redactPatterns'>, EntropyOptions {
    /**
     * Parent process environment (source).
     */
    parentEnv: ProcessEnv;
    /**
     * Composed dotenv map (target).
     */
    dotenv: ProcessEnv;
    /**
     * Optional subset of keys to trace. When omitted, all keys are traced.
     */
    keys?: string[];
    /**
     * Sink for trace lines (e.g., write to stderr).
     */
    write: (line: string) => void;
}
/**
 * Trace child env composition with redaction and entropy warnings.
 * Presentation-only: does not mutate env; writes lines via the provided sink.
 */
declare function traceChildEnv(opts: TraceChildEnvOptions): void;

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
 * Options for {@link dotenvExpandAll}.
 *
 * @public
 */
interface DotenvExpandAllOptions {
    /**
     * The reference object to use for expansion (defaults to process.env).
     */
    ref?: Record<string, string | undefined>;
    /**
     * Whether to progressively add expanded values to the set of reference keys.
     */
    progressive?: boolean;
}
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
declare function dotenvExpandAll<T extends Record<string, string | undefined> | Readonly<Record<string, string | undefined>>>(values: T, options?: DotenvExpandAllOptions): Record<string, string | undefined> & {
    [K in keyof T]: string | undefined;
};
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

/**
 * Deep interpolation utility for string leaves.
 * - Expands string values using dotenv-style expansion against the provided envRef.
 * - Preserves non-strings as-is.
 * - Does not recurse into arrays (arrays are returned unchanged).
 *
 * Intended for:
 * - Phase C option/config interpolation after composing ctx.dotenv.
 * - Per-plugin config slice interpolation before afterResolve.
 */

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

export { GetDotenvCli, baseRootOptionDefaults, buildSpawnEnv, createCli, defineDynamic, defineGetDotenvConfig, definePlugin, defineScripts, dotenvExpand, dotenvExpandAll, dotenvExpandFromProcessEnv, getDotenv, getDotenvCliOptions2Options, interpolateDeep, maybeWarnEntropy, readMergedOptions, redactDisplay, redactObject, shouldCapture, traceChildEnv };
export type { CreateCliOptions, DynamicFn, DynamicMap, EntropyOptions, GetDotenvCliOptions, GetDotenvCliPlugin, GetDotenvCliPublic, GetDotenvConfig, GetDotenvDynamic, GetDotenvOptions, InferGetDotenvVarsFromConfig, InferPluginConfig, PluginWithInstanceHelpers, ProcessEnv, RedactOptions, ScriptsTable, TraceChildEnvOptions };
