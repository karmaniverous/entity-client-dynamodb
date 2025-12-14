import { OptionValues, Command, InferCommandArguments, Option, CommandUnknownOpts } from '@commander-js/extra-typings';
import { z, ZodObject } from 'zod';
export { z } from 'zod';

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
 * Base CLI options derived from the shared root option defaults.
 * Used for type-safe initialization of CLI options bags.
 */
declare const baseGetDotenvCliOptions: Partial<GetDotenvCliOptions>;

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
/**
 * Build a help-time configuration bag for dynamic option descriptions.
 * Centralizes construction and reduces inline casts at call sites.
 */
declare const toHelpConfig: (merged: Partial<GetDotenvCliOptions> | Partial<RootOptionsShape>, plugins: Record<string, unknown> | undefined) => ResolvedHelpConfig;

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
 * Options for runCommandResult (buffered execution).
 *
 * @public
 */
interface RunCommandResultOptions {
    /**
     * Working directory for the child process.
     */
    cwd?: string | URL;
    /**
     * Environment variables for the child process. Undefined values are dropped.
     */
    env?: NodeJS.ProcessEnv;
    /**
     * Optional timeout (ms). Kills the child with SIGKILL on expiry.
     */
    timeoutMs?: number;
}
/**
 * Options for runCommand (execution with optional inherit/pipe).
 *
 * @public
 */
interface RunCommandOptions {
    /**
     * Working directory for the child process.
     */
    cwd?: string | URL;
    /**
     * Environment variables for the child process. Undefined values are dropped.
     */
    env?: NodeJS.ProcessEnv;
    /**
     * Stdio strategy for the child process.
     */
    stdio?: 'inherit' | 'pipe';
}
/**
 * Execute a command and capture stdout/stderr (buffered).
 * - Preserves plain vs shell behavior and argv/string normalization.
 * - Never re-emits stdout/stderr to parent; returns captured buffers.
 * - Supports optional timeout (ms).
 */
declare function runCommandResult(command: readonly string[], shell: false, opts?: RunCommandResultOptions): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
}>;
declare function runCommandResult(command: string | readonly string[], shell: string | boolean | URL, opts?: RunCommandResultOptions): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
}>;
declare function runCommand(command: readonly string[], shell: false, opts: RunCommandOptions): Promise<number>;
declare function runCommand(command: string | readonly string[], shell: string | boolean | URL, opts: RunCommandOptions): Promise<number>;

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

/** src/cliHost/getRootCommand.ts
 * Typed helper to retrieve the true root command (host) starting from any mount.
 */

/**
 * Return the top-level root command for a given mount or action's thisCommand.
 *
 * @param cmd - any command (mount or thisCommand inside an action)
 * @returns the root command instance
 */
declare const getRootCommand: (cmd: CommandUnknownOpts) => CommandUnknownOpts;

/** src/cliHost/invoke.ts
 * Shared helpers for composing child env overlays and preserving argv for Node -e.
 */

/**
 * Compose a child-process env overlay from dotenv and the merged CLI options bag.
 * Returns a shallow object including getDotenvCliOptions when serializable.
 */
declare function composeNestedEnv(merged: GetDotenvCliOptions | Record<string, unknown>, dotenv: Record<string, string | undefined>): Record<string, string>;
/**
 * Strip one layer of symmetric outer quotes (single or double) from a string.
 *
 * @param s - Input string.
 */
declare const stripOne: (s: string) => string;
/**
 * Preserve argv array for Node -e/--eval payloads under shell-off and
 * peel one symmetric outer quote layer from the code argument.
 */
declare function maybePreserveNodeEvalArgv(args: string[]): string[];

/** src/cliHost/paths.ts
 * Helpers for realized mount paths and plugin tree flattening.
 */

/**
 * A flattened plugin entry with its realized path.
 *
 * @public
 */
interface PluginFlattenedEntry<TOptions extends GetDotenvOptions = GetDotenvOptions, TArgs extends unknown[] = [], TOpts extends OptionValues = {}, TGlobal extends OptionValues = {}> {
    /** The plugin instance for this entry in the flattened tree. */
    plugin: GetDotenvCliPlugin<TOptions, TArgs, TOpts, TGlobal>;
    /**
     * The realized mount path for this plugin (root alias excluded), e.g. "aws/whoami".
     */
    path: string;
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
 * Batch services (neutral): resolve command and shell settings.
 * Shared by the generator path and the batch plugin to avoid circular deps.
 */

/**
 * Resolve a command string from the {@link ScriptsTable} table.
 * A script may be expressed as a string or an object with a `cmd` property.
 *
 * @param scripts - Optional scripts table.
 * @param command - User-provided command name or string.
 * @returns Resolved command string (falls back to the provided command).
 */
declare const resolveCommand: (scripts: ScriptsTable | undefined, command: string) => string;
/**
 * Resolve the shell setting for a given command:
 * - If the script entry is an object, prefer its `shell` override.
 * - Otherwise use the provided `shell` (string | boolean).
 *
 * @param scripts - Optional scripts table.
 * @param command - User-provided command name or string.
 * @param shell - Global shell preference (string | boolean).
 */
declare const resolveShell: <TShell extends string | boolean>(scripts: ScriptsTable<TShell> | undefined, command: string, shell: TShell | undefined) => TShell | false;

/**
 * Result of CLI option resolution.
 */
interface ResolveCliOptionsResult<T> {
    /**
     * The merged options object after applying defaults, inherited parent
     * values, and the current CLI flags. This bag is used as the effective
     * root options for the current invocation.
     */
    merged: T;
    /**
     * Positional command (string) resolved for invokers that accept a command
     * payload (e.g., batch parent or cmd alias). When absent, no command is set.
     */
    command?: string;
}
/**
 * Merge and normalize raw Commander options (current + parent + defaults)
 * into a GetDotenvCliOptions-like object. Types are intentionally wide to
 * avoid cross-layer coupling; callers may cast as needed.
 */
declare const resolveCliOptions: <T extends Partial<RootOptionsShape> & {
    scripts?: ScriptsTable;
}>(rawCliOptions: unknown, defaults: Partial<T>, parentJson?: string) => ResolveCliOptionsResult<T>;

/**
 * Build a sanitized environment object for spawning child processes.
 * Merges `base` and `overlay`, drops undefined values, and handles platform-specific
 * normalization (e.g. case-insensitivity on Windows).
 *
 * @param base - Base environment (usually `process.env`).
 * @param overlay - Environment variables to overlay.
 */
declare const buildSpawnEnv: (base?: NodeJS.ProcessEnv, overlay?: Record<string, string | undefined>) => NodeJS.ProcessEnv;

export { GetDotenvCli, baseGetDotenvCliOptions, buildSpawnEnv, composeNestedEnv, definePlugin, defineScripts, getRootCommand, maybePreserveNodeEvalArgv, readMergedOptions, resolveCliOptions, resolveCommand, resolveShell, runCommand, runCommandResult, stripOne, toHelpConfig };
export type { BrandOptions, DefineSpec, GetDotenvCliCtx, GetDotenvCliOptions, GetDotenvCliPlugin, GetDotenvCliPublic, InferPluginConfig, PluginChildEntry, PluginFlattenedEntry, PluginNamespaceOverride, PluginWithInstanceHelpers, ResolveAndLoadOptions, ResolveCliOptionsResult, ResolvedHelpConfig, RootOptionsShape, RunCommandOptions, RunCommandResultOptions, ScriptDef, Scripts, ScriptsTable };
