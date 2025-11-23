/**
 * Versioned layout discovery and resolution helpers.
 *
 * Requirements addressed:
 * - Opinionated layout under tablesPath with configurable tokens.
 * - Per-step EM resolution for prev/next using fallback (walk backward).
 * - Transform path discovery (optional per version).
 *
 * Notes:
 * - Loading (dynamic import/TS transpile) is performed by higher-level services.
 * - These helpers only resolve filesystem paths deterministically.
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

export interface VersionedLayoutTokens {
  /** Table definition token (filename without extension). Default: "table". */
  table?: string;
  /** EntityManager token (filename without extension). Default: "entityManager". */
  entityManager?: string;
  /** Transform token (filename without extension). Default: "transform". */
  transform?: string;
}

export interface VersionedLayoutConfig {
  /** Root path for versioned assets. Default: "tables". */
  tablesPath?: string;
  /** File tokens (without extensions). */
  tokens?: VersionedLayoutTokens;
}

export interface VersionedPaths {
  root: string;
  versionDir: string;
  tableFileCandidates: string[];
  entityManagerFileCandidates: string[];
  transformFileCandidates: string[];
}

const DEFAULT_TABLES_PATH = 'tables';
const DEFAULT_TOKENS = {
  table: 'table',
  entityManager: 'entityManager',
  transform: 'transform',
} as const;

const TS_JS = ['.ts', '.js'];
const YML_YAML = ['.yml', '.yaml'];

/** Zero-pad and validate a version token (e.g., "003"). */
export function normalizeVersionToken(version: string): string {
  const trimmed = String(version ?? '').trim();
  if (!/^\d+$/.test(trimmed))
    throw new Error(`invalid version token: ${version}`);
  // keep original padding; assume directories are already zero-padded in repo
  return trimmed;
}

/** List version directories (NNN) under tablesPath in ascending numeric order. */
export async function listVersionDirs(
  tablesPath = DEFAULT_TABLES_PATH,
): Promise<string[]> {
  const root = resolve(tablesPath);
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(a) - Number(b));
}

/** Build candidate file paths for a specific version. */
export function getVersionedPaths(
  version: string,
  cfg?: VersionedLayoutConfig,
): VersionedPaths {
  const root = resolve(cfg?.tablesPath ?? DEFAULT_TABLES_PATH);
  const tokens = { ...DEFAULT_TOKENS, ...(cfg?.tokens ?? {}) };
  const versionDir = join(root, normalizeVersionToken(version));

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
    tableFileCandidates,
    entityManagerFileCandidates,
    transformFileCandidates,
  };
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

/** Resolve table.yml path for a version (no fallback; must exist for create-table). */
export async function resolveTableFile(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<string | undefined> {
  const vp = getVersionedPaths(version, cfg);
  return firstExisting(vp.tableFileCandidates);
}

/**
 * Resolve entityManager module path for a version with fallback (walk backward).
 * Returns the nearest existing {version}/entityManager.(ts|js) path or undefined.
 */
export async function resolveEntityManagerFileWithFallback(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<string | undefined> {
  const versions = await listVersionDirs(
    cfg?.tablesPath ?? DEFAULT_TABLES_PATH,
  );
  const target = normalizeVersionToken(version);
  if (!versions.includes(target)) versions.push(target);
  const ordered = Array.from(new Set(versions)).sort(
    (a, b) => Number(a) - Number(b),
  );

  // Scan descending from target to the earliest version
  for (let i = ordered.indexOf(target); i >= 0; i--) {
    const v = ordered[i];
    const vp = getVersionedPaths(v, cfg);
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
  const vp = getVersionedPaths(version, cfg);
  return firstExisting(vp.transformFileCandidates);
}

/**
 * Compute the inclusive ascending list of step versions K where from < k ≤ to.
 * Both versions must exist in the directory listing (we do not create directories).
 */
export async function enumerateStepVersions(
  fromVersion: string,
  toVersion: string,
  cfg?: VersionedLayoutConfig,
): Promise<string[]> {
  const versions = await listVersionDirs(
    cfg?.tablesPath ?? DEFAULT_TABLES_PATH,
  );
  const from = Number(normalizeVersionToken(fromVersion));
  const to = Number(normalizeVersionToken(toVersion));
  if (!(to > from))
    throw new Error(`toVersion must be greater than fromVersion`);
  return versions
    .map((v) => Number(v))
    .filter((n) => n > from && n <= to)
    .sort((a, b) => a - b)
    .map((n) => String(n).padStart(3, '0'));
}
