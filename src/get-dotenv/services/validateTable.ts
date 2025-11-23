/**
 * Validate a versioned table.yml against the resolved EntityManager (fallback-aware).
 *
 * Requirements addressed:
 * - Resolve EM for the specified version using fallback (walk backward).
 * - Ensure tables/NNN/table.yml exists; error if missing.
 * - Validate generated sections and return structured diffs (no console I/O here).
 */

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

import { resolveAndLoadEntityManager } from '../emLoader';
import {
  getVersionedPaths,
  resolveTableFile,
  type VersionedLayoutConfig,
} from '../layout';
import { validateGeneratedSections, type ValidateResult } from '../validate';

/**
 * Validate generated sections in tables/NNN/table.yml against the resolved EntityManager.
 *
 * @param version - Version token (NNN).
 * @param cfg - Versioned layout config/tokens.
 *
 * @returns ValidateResult plus tablePath for diagnostics.
 */
export async function validateTableDefinitionAtVersion(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<ValidateResult & { tablePath: string }> {
  // Resolve table path and ensure it exists.
  const vp = getVersionedPaths(version, cfg);
  const tablePath =
    (await resolveTableFile(version, cfg)) ?? vp.tableFileCandidates[0];
  const abs = resolve(tablePath);

  try {
    const st = await fs.stat(abs);
    if (!st.isFile()) throw new Error('not a file');
  } catch {
    throw new Error(
      `table definition not found for version ${version}: ${abs}`,
    );
  }

  // Resolve & load EM with fallback (walk backward).
  const em = await resolveAndLoadEntityManager(version, cfg);

  // Validate generated sections; return result with table path for convenience.
  const result = await validateGeneratedSections(abs, em as never);
  return { ...result, tablePath: abs };
}
