import { OptionValues, Command, InferCommandArguments, Option } from '@commander-js/extra-typings';
import { z, ZodObject } from 'zod';

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
 * Zod schema for AWS plugin configuration.
 */
declare const AwsPluginConfigSchema: z.ZodObject<{
    profile: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    defaultRegion: z.ZodOptional<z.ZodString>;
    profileKey: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    profileFallbackKey: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    regionKey: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    strategy: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        "cli-export": "cli-export";
        none: "none";
    }>>>;
    loginOnDemand: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, z.core.$strip>;
/**
 * AWS plugin configuration object.
 */
type AwsPluginConfig = z.infer<typeof AwsPluginConfigSchema>;
/**
 * Arguments for resolving AWS context (profile/region/credentials).
 *
 * @public
 */
interface ResolveAwsContextOptions {
    /**
     * The current composed dotenv variables.
     */
    dotenv: ProcessEnv;
    /** Plugin configuration. */
    cfg: AwsPluginConfig;
}

/**
 * AWS plugin: establishes an AWS session (credentials/region) based on dotenv configuration.
 * Supports SSO login-on-demand and credential exporting.
 * Can be used as a parent command to wrap `aws` CLI invocations.
 */
declare const awsPlugin: () => PluginWithInstanceHelpers<GetDotenvOptions, {
    profile?: string | undefined;
    region?: string | undefined;
    defaultRegion?: string | undefined;
    profileKey?: string | undefined;
    profileFallbackKey?: string | undefined;
    regionKey?: string | undefined;
    strategy?: "cli-export" | "none" | undefined;
    loginOnDemand?: boolean | undefined;
}, [], {}, {}>;

export { awsPlugin };
export type { ResolveAwsContextOptions };
