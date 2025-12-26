/**
 * Versioned layout discovery and resolution helpers.
 *
 * Requirements addressed:
 * - Opinionated layout under tablesPath with configurable tokens.
 * - Version ordering by numeric value (not lexicographic token ordering).
 * - Duplicate numeric version directory tokens are rejected (e.g., 1 and 001).
 * - Optional cosmetic padding width via minTableVersionWidth.
 * - Per-step EM resolution for prev/next using fallback (walk backward).
 * - Transform path discovery (optional per version).
 *
 * Notes:
 * - Loading (dynamic import/TS transpile) is performed by higher-level services.
 * - These helpers only resolve filesystem paths deterministically.
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Filename tokens (without extensions) used by the versioned layout.
 *
 * @category get-dotenv
 */
export interface VersionedLayoutTokens {
  /** Table definition token (filename without extension). Default: "table". */
  table?: string;
  /** EntityManager token (filename without extension). Default: "entityManager". */
  entityManager?: string;
  /** Transform token (filename without extension). Default: "transform". */
  transform?: string;
}

/**
 * Configuration for versioned tables layout resolution.
 *
 * @category get-dotenv
 */
export interface VersionedLayoutConfig {
  /** Root path for versioned assets. Default: "tables". */
  tablesPath?: string;
  /** Minimum width for left-zero padding when formatting version tokens. Default: 3. */
  minTableVersionWidth?: number;
  /** File tokens (without extensions). */
  tokens?: VersionedLayoutTokens;
}

/**
 * A discovered version directory under tablesPath.
 *
 * @category get-dotenv
 */
export interface VersionDir {
  /** Directory token (digit-only, as found on disk). */
  token: string;
  /** Parsed numeric value of the token. */
  value: number;
}

/**
 * Resolved candidate paths for a specific version token/value.
 *
 * @category get-dotenv
 */
export interface VersionedPaths {
  /** Absolute resolved tables root path. */
  root: string;
  /** Absolute version directory path. */
  versionDir: string;
  /** Version directory token (digit-only). */
  versionToken: string;
  /** Parsed numeric value of the version token. */
  versionValue: number;
  /** Candidate table file paths (yml/yaml) in precedence order. */
  tableFileCandidates: string[];
  /** Candidate EntityManager module paths (ts/js) in precedence order. */
  entityManagerFileCandidates: string[];
  /** Candidate transform module paths (ts/js) in precedence order. */
  transformFileCandidates: string[];
}

const DEFAULT_TABLES_PATH = 'tables';
const DEFAULT_MIN_WIDTH = 3;
const DEFAULT_TOKENS = {
  table: 'table',
  entityManager: 'entityManager',
  transform: 'transform',
} as const;

const TS_JS = ['.ts', '.js'];
const YML_YAML = ['.yml', '.yaml'];

/** Parse a version value from a digit-only token (e.g., "003" or "3"). */
export function parseVersionValue(version: string): number {
  const trimmed = version.trim();
  if (!/^\d+$/.test(trimmed))
    throw new Error(`invalid version token: ${version}`);
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`invalid version token (out of range): ${version}`);
  return n;
}

/** Format a numeric version value into a token with minimum width padding. */
export function formatVersionToken(
  value: number,
  cfg?: VersionedLayoutConfig,
): string {
  const minWidth = cfg?.minTableVersionWidth ?? DEFAULT_MIN_WIDTH;
  if (!Number.isInteger(minWidth) || minWidth <= 0)
    throw new Error(`minTableVersionWidth must be a positive integer`);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`version value must be a non-negative safe integer`);
  return String(value).padStart(minWidth, '0');
}

/** List version directories (NNN) under tablesPath in ascending numeric order. */
export async function listVersionDirs(
  tablesPath = DEFAULT_TABLES_PATH,
): Promise<string[]> {
  const dirs = await listVersionDirEntries({ tablesPath });
  return dirs.map((d) => d.token);
}

/** Build candidate file paths for a specific version. */
export function getVersionedPathsForToken(
  versionToken: string,
  versionValue: number,
  cfg?: VersionedLayoutConfig,
): VersionedPaths {
  const root = resolve(cfg?.tablesPath ?? DEFAULT_TABLES_PATH);
  const versionTokenTrimmed = versionToken.trim();
  if (!/^\d+$/.test(versionTokenTrimmed))
    throw new Error(`invalid version directory token: ${versionToken}`);
  const tokens = { ...DEFAULT_TOKENS, ...(cfg?.tokens ?? {}) };
  const versionDir = join(root, versionTokenTrimmed);

  const tableFileCandidates = YML_YAML.map((ext) =>
    join(versionDir, `${tokens.table}${ext}`),
  );

  const entityManagerFileCandidates = TS_JS.map((ext) =>
    join(versionDir, `${tokens.entityManager}${ext}`),
  );

  const transformFileCandidates = TS_JS.map((ext) =>
    join(versionDir, `${tokens.transform}${ext}`),
  );

  return {
    root,
    versionDir,
    versionToken: versionTokenTrimmed,
    versionValue,
    tableFileCandidates,
    entityManagerFileCandidates,
    transformFileCandidates,
  };
}

/**
 * List version directory entries under `tablesPath` and return them sorted by numeric value.
 *
 * @param cfg - Versioned layout config.
 * @returns Version directories (token + numeric value), sorted ascending.
 *
 * @category get-dotenv
 */
export async function listVersionDirEntries(
  cfg?: VersionedLayoutConfig,
): Promise<VersionDir[]> {
  const root = resolve(cfg?.tablesPath ?? DEFAULT_TABLES_PATH);
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  const tokens = entries
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => e.name);

  const dirs: VersionDir[] = tokens.map((t) => ({
    token: t,
    value: parseVersionValue(t),
  }));

  // Detect duplicates by numeric value (e.g., "1" and "001").
  const byValue = new Map<number, string[]>();
  for (const d of dirs) {
    const list = byValue.get(d.value) ?? [];
    list.push(d.token);
    byValue.set(d.value, list);
  }
  for (const [value, toks] of byValue.entries()) {
    if (toks.length > 1) {
      throw new Error(
        `duplicate version directories for value ${String(value)}: ${toks.join(', ')}`,
      );
    }
  }

  return dirs.sort((a, b) => a.value - b.value);
}

/**
 * Resolve a version directory token/value pair for a requested version.
 *
 * @param version - Version token string (digit-only; padding allowed).
 * @param cfg - Versioned layout config.
 * @param options - Resolution options.
 * @returns Resolved version directory token/value.
 *
 * @category get-dotenv
 */
export async function resolveVersionDir(
  version: string,
  cfg?: VersionedLayoutConfig,
  options?: { mustExist?: boolean },
): Promise<VersionDir> {
  const value = parseVersionValue(version);
  const dirs = await listVersionDirEntries(cfg);
  const found = dirs.find((d) => d.value === value);
  if (found) return found;
  if (options?.mustExist) {
    const known = dirs.map((d) => d.token).join(', ');
    throw new Error(
      `version directory not found for ${String(value)} under ${cfg?.tablesPath ?? DEFAULT_TABLES_PATH} (known: ${known || 'none'})`,
    );
  }
  return { token: formatVersionToken(value, cfg), value };
}

/** Return the first existing path from candidates, or undefined. */
async function firstExisting(
  candidates: string[],
): Promise<string | undefined> {
  for (const p of candidates) {
    try {
      const st = await fs.stat(p);
      if (st.isFile()) return p;
    } catch {
      // ignore
    }
  }
  return undefined;
}

/** Resolve the table definition path for a version (no fallback; must exist for create-table). */
export async function resolveTableFile(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<string | undefined> {
  const vd = await resolveVersionDir(version, cfg, { mustExist: false });
  const vp = getVersionedPathsForToken(vd.token, vd.value, cfg);
  return firstExisting(vp.tableFileCandidates);
}

/**
 * Resolve the entityManager module path for a version with fallback (walk backward).
 * Returns the nearest existing version directory entityManager.(ts|js) path or undefined.
 */
export async function resolveEntityManagerFileWithFallback(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<string | undefined> {
  const targetValue = parseVersionValue(version);
  const dirs = await listVersionDirEntries(cfg);

  // Scan descending across directories whose numeric value <= targetValue.
  for (let i = dirs.length - 1; i >= 0; i--) {
    const d = dirs[i];
    if (d.value > targetValue) continue;
    const vp = getVersionedPathsForToken(d.token, d.value, cfg);
    const found = await firstExisting(vp.entityManagerFileCandidates);
    if (found) return found;
  }
  return undefined;
}

/** Resolve transform module path for a version (no fallback; optional). */
export async function resolveTransformFile(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<string | undefined> {
  const vd = await resolveVersionDir(version, cfg, { mustExist: false });
  const vp = getVersionedPathsForToken(vd.token, vd.value, cfg);
  return firstExisting(vp.transformFileCandidates);
}

/**
 * Compute the inclusive ascending list of step versions where
 * fromVersion \< k \<= toVersion. We do not create directories.
 */
export async function enumerateStepVersions(
  fromVersion: string,
  toVersion: string,
  cfg?: VersionedLayoutConfig,
): Promise<string[]> {
  const from = parseVersionValue(fromVersion);
  const to = parseVersionValue(toVersion);
  if (!(to > from))
    throw new Error(`toVersion must be greater than fromVersion`);

  const dirs = await listVersionDirEntries(cfg);
  return dirs
    .filter((d) => d.value > from && d.value <= to)
    .map((d) => d.token);
}
