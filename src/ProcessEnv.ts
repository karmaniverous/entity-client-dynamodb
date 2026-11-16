/**
 * String-valued environment map used by the public API and CLI helpers.
 *
 * Kept local so the main package entry does not expose types from the optional
 * get-dotenv peer dependency.
 *
 * @category Types
 */
export type ProcessEnv = Record<string, string | undefined>;
