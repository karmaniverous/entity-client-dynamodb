import { Command } from 'commander';
import { ZodType } from 'zod';

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

/** src/cliHost/definePlugin.ts
 * Plugin contracts for the GetDotenv CLI host.
 *
 * This module exposes a structural public interface for the host that plugins
 * should use (GetDotenvCliPublic). Using a structural type at the seam avoids
 * nominal class identity issues (private fields) in downstream consumers.
 */

/**
 * Structural public interface for the host exposed to plugins.
 * - Extends Commander.Command so plugins can attach options/commands/hooks.
 * - Adds host-specific helpers used by built-in plugins.
 *
 * Purpose: remove nominal class identity (private fields) from the plugin seam
 * to avoid TS2379 under exactOptionalPropertyTypes in downstream consumers.
 */
type GetDotenvCliPublic<TOptions extends GetDotenvOptions = GetDotenvOptions> = Command & {
    ns: (name: string) => Command;
    getCtx: () => GetDotenvCliCtx<TOptions> | undefined;
    resolveAndLoad: (customOptions?: Partial<TOptions>) => Promise<GetDotenvCliCtx<TOptions>>;
};
/** Public plugin contract used by the GetDotenv CLI host. */
interface GetDotenvCliPlugin {
    id?: string;
    /**
     * Setup phase: register commands and wiring on the provided CLI instance.
     * Runs parent → children (pre-order).
     */
    setup: (cli: GetDotenvCliPublic) => void | Promise<void>;
    /**
     * After the dotenv context is resolved, initialize any clients/secrets
     * or attach per-plugin state under ctx.plugins (by convention).
     * Runs parent → children (pre-order).
     */
    afterResolve?: (cli: GetDotenvCliPublic, ctx: GetDotenvCliCtx) => void | Promise<void>;
    /**
     * Optional Zod schema for this plugin's config slice (from config.plugins[id]).
     * When provided, the host validates the merged config under the guarded loader path.
     */
    configSchema?: ZodType;
    /**
     * Compositional children. Installed after the parent per pre-order.
     */
    children: GetDotenvCliPlugin[];
    /**
     * Compose a child plugin. Returns the parent to enable chaining.
     */
    use: (child: GetDotenvCliPlugin) => GetDotenvCliPlugin;
}
/**
 * Public spec type for defining a plugin with optional children.
 * Exported to ensure TypeDoc links and navigation resolve correctly.
 */
type DefineSpec = Omit<GetDotenvCliPlugin, 'children' | 'use'> & {
    children?: GetDotenvCliPlugin[];
};
/**
 * Define a GetDotenv CLI plugin with compositional helpers.
 *
 * @example
 * const parent = definePlugin(\{ id: 'p', setup(cli) \{ /* ... *\/ \} \})
 *   .use(childA)
 *   .use(childB);
 */
declare const definePlugin: (spec: DefineSpec) => GetDotenvCliPlugin;

/** * Per-invocation context shared with plugins and actions. */
type GetDotenvCliCtx<TOptions extends GetDotenvOptions = GetDotenvOptions> = {
    optionsResolved: TOptions;
    dotenv: ProcessEnv;
    plugins?: Record<string, unknown>;
    pluginConfigs?: Record<string, unknown>;
};
declare const HELP_HEADER_SYMBOL: unique symbol;
/**
 * Plugin-first CLI host for get-dotenv. Extends Commander.Command.
 *
 * Responsibilities:
 * - Resolve options strictly and compute dotenv context (resolveAndLoad).
 * - Expose a stable accessor for the current context (getCtx).
 * - Provide a namespacing helper (ns).
 * - Support composable plugins with parent → children install and afterResolve.
 *
 * NOTE: This host is additive and does not alter the legacy CLI.
 */
declare class GetDotenvCli$1<TOptions extends GetDotenvOptions = GetDotenvOptions> extends Command {
    #private;
    /** Registered top-level plugins (composition happens via .use()) */
    private _plugins;
    /** One-time installation guard */
    private _installed;
    /** Optional header line to prepend in help output */
    private [HELP_HEADER_SYMBOL];
    constructor(alias?: string);
    /**
     * Resolve options (strict) and compute dotenv context.   * Stores the context on the instance under a symbol.
     */
    resolveAndLoad(customOptions?: Partial<TOptions>): Promise<GetDotenvCliCtx<TOptions>>;
    /**
     * Retrieve the current invocation context (if any).
     */
    getCtx(): GetDotenvCliCtx<TOptions> | undefined;
    /**
     * Retrieve the merged root CLI options bag (if set by passOptions()).
     * Downstream-safe: no generics required.
     */
    getOptions(): GetDotenvCliOptions | undefined;
    /** Internal: set the merged root options bag for this run. */
    _setOptionsBag(bag: GetDotenvCliOptions): void;
    /**   * Convenience helper to create a namespaced subcommand.
     */
    ns(name: string): Command;
    /**
     * Tag options added during the provided callback as 'app' for grouped help.
     * Allows downstream apps to demarcate their root-level options.
     */
    tagAppOptions<T>(fn: (root: Command) => T): T;
    /**
     * Branding helper: set CLI name/description/version and optional help header.
     * If version is omitted and importMetaUrl is provided, attempts to read the
     * nearest package.json version (best-effort; non-fatal on failure).
     */
    brand(args: {
        name?: string;
        description?: string;
        version?: string;
        importMetaUrl?: string;
        helpHeader?: string;
    }): Promise<this>;
    /**
     * Register a plugin for installation (parent level).
     * Installation occurs on first resolveAndLoad() (or explicit install()).
     */
    use(plugin: GetDotenvCliPlugin): this;
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
 * GetDotenvCli with root helpers as real class methods.
 * - attachRootOptions: installs legacy/base root flags on the command.
 * - passOptions: merges flags (parent \< current), computes dotenv context once,
 *   runs validation, and persists merged options for nested flows.
 */
declare class GetDotenvCli extends GetDotenvCli$1 {
    /**
     * Attach legacy root flags to this CLI instance. Defaults come from
     * baseRootOptionDefaults when none are provided.
     */
    attachRootOptions(defaults?: Partial<RootOptionsShape>, opts?: {
        includeCommandOption?: boolean;
    }): this;
    /**
     * Install preSubcommand/preAction hooks that:
     * - Merge options (parent round-trip + current invocation) using resolveCliOptions.
     * - Persist the merged bag on the current command and on the host (for ergonomics).
     * - Compute the dotenv context once via resolveAndLoad(serviceOptions).
     * - Validate the composed env against discovered config (warn or --strict fail).
     */
    passOptions(defaults?: Partial<RootOptionsShape>): this;
}
/**
 * Helper to retrieve the merged root options bag from any action handler
 * that only has access to thisCommand. Avoids structural casts.
 */
declare const readMergedOptions: (cmd: Command) => GetDotenvCliOptions | undefined;

export { GetDotenvCli, definePlugin, readMergedOptions };
export type { DefineSpec, GetDotenvCliCtx, GetDotenvCliOptions, GetDotenvCliPlugin, GetDotenvCliPublic, ScriptsTable };
