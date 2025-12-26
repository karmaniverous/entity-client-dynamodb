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
  getVersionedPathsForToken,
  resolveTableFile,
  resolveVersionDir,
  type VersionedLayoutConfig,
} from '../layout';
import type { ManagedTablePropertiesInfo } from '../tableProperties';
import { validateGeneratedSections, type ValidateResult } from '../validate';

/**
 * Result returned by {@link validateTableDefinitionAtVersion | `validateTableDefinitionAtVersion`}.
 *
 * @category get-dotenv
 */
export interface ValidateTableDefinitionAtVersionResult extends ValidateResult {
  /** Absolute path to the validated table.yml (for diagnostics/UX). */
  tablePath: string;
}

/**
 * Validate generated sections in tables/NNN/table.yml against the resolved EntityManager.
 *
 * @param version - Version token (NNN).
 * @param cfg - Versioned layout config/tokens.
 * @param managed - Optional managed table properties to validate for drift.
 *
 * @returns ValidateResult plus tablePath for diagnostics.
 */
export async function validateTableDefinitionAtVersion(
  version: string,
  cfg?: VersionedLayoutConfig,
  managed?: ManagedTablePropertiesInfo,
): Promise<ValidateTableDefinitionAtVersionResult> {
  // Resolve table path and ensure it exists.
  const vd = await resolveVersionDir(version, cfg, { mustExist: false });
  const vp = getVersionedPathsForToken(vd.token, vd.value, cfg);
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
  const result = await validateGeneratedSections(abs, em as never, managed);
  return { ...result, tablePath: abs };
}
