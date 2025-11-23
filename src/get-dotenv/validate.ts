/**
 * Validation helpers for generated sections in tables/NNN/table.yml.
 *
 * Requirements addressed:
 * - Compare the three generated sections in Properties against EM output:
 *   • AttributeDefinitions
 *   • KeySchema
 *   • GlobalSecondaryIndexes
 * - Return a structured diff (key + expected + actual) for CLI presentation.
 * - Keep YAML parsing comment-safe (we do not modify anything here).
 */

import { promises as fs } from 'node:fs';

import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';
import YAML from 'yaml';

import type { GeneratedSections } from './tableDefinition';
import { computeGeneratedSections } from './tableDefinition';

function pickGeneratedFromDoc(doc: YAML.Document): GeneratedSections {
  const props = doc.get('Properties') as YAML.YAMLMap | undefined;
  if (!props || typeof props !== 'object' || !('get' in props)) return {};
  const getKey = (k: string) => props.get(k);
  return {
    AttributeDefinitions: getKey('AttributeDefinitions'),
    KeySchema: getKey('KeySchema'),
    GlobalSecondaryIndexes: getKey('GlobalSecondaryIndexes'),
  };
}

function stableStringify(value: unknown): string {
  // For our generated sections (arrays of maps), JSON.stringify is stable enough
  // given we don't reorder keys when computing generated sections.
  return JSON.stringify(value ?? null);
}

export interface GeneratedDiff {
  key: keyof GeneratedSections;
  expected: unknown;
  actual: unknown;
}

export interface ValidateResult {
  equal: boolean;
  diffs: GeneratedDiff[];
}

/**
 * Validate generated sections of a table.yml against the provided EntityManager.
 *
 * @param tablePath - Path to tables/NNN/table.yml
 * @param em - EntityManager for the target step
 */
export async function validateGeneratedSections<C extends BaseConfigMap>(
  tablePath: string,
  em: EntityManager<C>,
): Promise<ValidateResult> {
  const src = await fs.readFile(tablePath, 'utf8');
  const doc = YAML.parseDocument(src);

  const expected = computeGeneratedSections(em);
  const actual = pickGeneratedFromDoc(doc);

  const diffs: GeneratedDiff[] = [];

  (
    ['AttributeDefinitions', 'KeySchema', 'GlobalSecondaryIndexes'] as const
  ).forEach((k) => {
    const exp = (expected as Record<string, unknown>)[k];
    const act = (actual as Record<string, unknown>)[k];
    if (stableStringify(exp) !== stableStringify(act)) {
      diffs.push({ key: k, expected: exp, actual: act });
    }
  });

  return { equal: diffs.length === 0, diffs };
}
