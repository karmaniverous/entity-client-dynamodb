/**
 * Create a DynamoDB table from versioned table.yml with optional validate/refresh.
 *
 * Requirements addressed:
 * - Read tables/NNN/table.yml; error if missing.
 * - If refreshGenerated: compute and update generated nodes in place; else if validate: error on drift unless forced.
 * - Merge optional TableName override for creation-time only (does not rewrite YAML).
 * - Waiters supported via maxSeconds.
 */

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';
import YAML from 'yaml';

import type { EntityClient } from '../../EntityClient/EntityClient';
import type { WaiterConfig } from '../../EntityClient/WaiterConfig';
import {
  getVersionedPathsForToken,
  listVersionDirEntries,
  resolveTableFile,
  resolveVersionDir,
  type VersionedLayoutConfig,
} from '../layout';
import {
  computeGeneratedSections,
  type GeneratedSections,
  refreshGeneratedSectionsInPlace,
} from '../tableDefinition';
import { validateGeneratedSections } from '../validate';

export interface CreateOptions {
  validate?: boolean; // default true
  refreshGenerated?: boolean; // default false
  waiter?: WaiterConfig; // default { maxWaitTime: 60 }
  /** Allow creating a table at a non-latest version (unsafe by default). */
  allowNonLatest?: boolean;
  /** One-off TableName override (does not persist to YAML). */
  tableNameOverride?: string;
  /** Force create on drift (skip validation error). Prefer refreshGenerated when possible. */
  force?: boolean;
}

/** Extract a plain JS object from the "Properties" node of table.yml. */
function extractProperties(doc: YAML.Document): Record<string, unknown> {
  const props = doc.get('Properties');
  // Re-emit via YAML to ensure a plain JS object (handle YAMLMap)
  return YAML.parse(YAML.stringify(props ?? {})) as Record<string, unknown>;
}

export async function createTableAtVersion<C extends BaseConfigMap>(
  client: EntityClient<C>,
  em: EntityManager<C>,
  version: string,
  cfg?: VersionedLayoutConfig,
  options?: CreateOptions,
) {
  const vd = await resolveVersionDir(version, cfg, { mustExist: true });

  // Latest-only create guard (unsafe by default in all environments).
  const dirs = await listVersionDirEntries(cfg);
  if (!dirs.length) {
    throw new Error(
      `no version directories found under ${cfg?.tablesPath ?? 'tables'}`,
    );
  }
  const latest = dirs[dirs.length - 1];
  if (vd.value !== latest.value && !options?.allowNonLatest) {
    throw new Error(
      `refusing to create non-latest version ${String(vd.value)} (latest is ${String(latest.value)}). ` +
        `Re-run with --allow-non-latest to override.`,
    );
  }

  const vp = getVersionedPathsForToken(vd.token, vd.value, cfg);
  const tablePath =
    (await resolveTableFile(version, cfg)) ?? vp.tableFileCandidates[0];
  const abs = resolve(tablePath);

  // Must exist
  try {
    const st = await fs.stat(abs);
    if (!st.isFile()) throw new Error('not a file');
  } catch {
    throw new Error(
      `table definition not found for version ${version}: ${abs}`,
    );
  }

  const validate = options?.validate ?? true;
  const refresh = options?.refreshGenerated ?? false;

  if (refresh) {
    const generated: GeneratedSections = computeGeneratedSections(em);
    await refreshGeneratedSectionsInPlace(abs, generated);
  } else if (validate) {
    const { equal, diffs } = await validateGeneratedSections(abs, em);
    if (!equal && !options?.force) {
      const details = diffs.map((d) => `- ${d.key}`).join('\n');
      throw new Error(
        `table definition drift detected for version ${version}:\n${details}\n` +
          `Use --refresh-generated to update, or --force to proceed without refreshing.`,
      );
    }
  }

  // Read fresh doc
  const src = await fs.readFile(abs, 'utf8');
  const doc = YAML.parseDocument(src);
  const props = extractProperties(doc);

  if (options?.tableNameOverride) {
    props.TableName = options.tableNameOverride;
  }

  const waiter = { maxWaitTime: 60, ...(options?.waiter ?? {}) };
  return client.createTable(props as never, waiter);
}
