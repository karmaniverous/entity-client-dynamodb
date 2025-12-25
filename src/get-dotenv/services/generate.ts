/**
 * Generate/refresh table.yml for a version (comment-preserving).
 *
 * Requirements addressed:
 * - Compose a new file from root baseline + generated nodes, or
 * - Refresh an existing file by replacing only generated nodes.
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';

import {
  getVersionedPathsForToken,
  resolveVersionDir,
  type VersionedLayoutConfig,
  type VersionedPaths,
} from '../layout';
import {
  composeNewTableYaml,
  computeGeneratedSections,
  type OverlayOptions,
  refreshGeneratedSectionsInPlace,
} from '../tableDefinition';

export interface GenerateOptions {
  /** Overlays for initial composition (optional; ignored on refresh unless caller requests). */
  overlays?: OverlayOptions;
  /** When true, refresh even if the file exists (replacing only generated nodes). */
  force?: boolean;
}

/**
 * Generate or refresh a versioned table.yml.
 *
 * @param em - EntityManager for the target version (or fallback EM).
 * @param version - Version token (NNN).
 * @param cfg - Versioned layout config/tokens.
 * @param options - Generate options (overlays, force).
 */
export async function generateTableDefinitionAtVersion<C extends BaseConfigMap>(
  em: EntityManager<C>,
  version: string,
  cfg?: VersionedLayoutConfig,
  options?: GenerateOptions,
): Promise<{ path: string; refreshed: boolean }> {
  const vd = await resolveVersionDir(version, cfg, { mustExist: false });
  const vp = getVersionedPathsForToken(vd.token, vd.value, cfg);
  const tableFile = resolve(
    await ensureDir(vp.versionDir),
    resolveTableFilePath(vp),
  );
  const baselineRoot = join(vp.root, 'table.template.yml');
  const baselineRootYaml = await fileIfExists(baselineRoot);

  const generated = computeGeneratedSections(em);
  const exists = await fileExists(tableFile);

  if (exists && !options?.force) {
    // Refresh in place: replace only generated nodes; preserve comments/other properties.
    await refreshGeneratedSectionsInPlace(tableFile, generated);
    return { path: tableFile, refreshed: true };
  }

  // Compose a new file (from baselineRoot if present) + generated nodes + overlays
  await composeNewTableYaml(
    tableFile,
    baselineRootYaml,
    generated,
    options?.overlays,
  );
  return { path: tableFile, refreshed: false };
}

async function ensureDir(dir: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function fileIfExists(path: string): Promise<string | undefined> {
  try {
    const st = await fs.stat(path);
    return st.isFile() ? path : undefined;
  } catch {
    return undefined;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const st = await fs.stat(path);
    return st.isFile();
  } catch {
    return false;
  }
}

function resolveTableFilePath(vp: VersionedPaths): string {
  // first candidate with .yml; if not present use .yaml
  return vp.tableFileCandidates[0];
}
