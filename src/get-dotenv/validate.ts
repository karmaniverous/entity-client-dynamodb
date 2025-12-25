/**
 * Validation helpers for generated sections in tables/NNN/table.yml.
 *
 * Requirements addressed:
 * - Compare the three generated sections in Properties against EM output:
 *   • AttributeDefinitions
 *   • KeySchema
 *   • GlobalSecondaryIndexes
 * - Return a structured diff (key + expected + actual) for CLI presentation (order-insensitive).
 * - Keep YAML parsing comment-safe (we do not modify anything here).
 */

import { promises as fs } from 'node:fs';

import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';
import YAML from 'yaml';

import type { GeneratedSections } from './tableDefinition';
import { computeGeneratedSections } from './tableDefinition';
import type { ManagedTablePropertiesInfo } from './tableProperties';
import {
  assertManagedTablePropertiesInvariants,
  pickManagedActualFromProperties,
} from './tableProperties';

function pickGeneratedFromDoc(doc: YAML.Document): GeneratedSections {
  const props = doc.get('Properties') as YAML.YAMLMap | undefined;
  if (!props || typeof props !== 'object' || !('get' in props)) return {};
  const getKey = (k: string) => props.get(k);

  const attributeDefinitions = getKey(
    'AttributeDefinitions',
  ) as CreateTableCommandInput['AttributeDefinitions'];
  const keySchema = getKey('KeySchema') as CreateTableCommandInput['KeySchema'];
  const globalSecondaryIndexes = getKey(
    'GlobalSecondaryIndexes',
  ) as CreateTableCommandInput['GlobalSecondaryIndexes'];

  return {
    AttributeDefinitions: attributeDefinitions,
    KeySchema: keySchema,
    GlobalSecondaryIndexes: globalSecondaryIndexes,
  } as GeneratedSections;
}

function canonicalizeAttributeDefinitions(
  v: GeneratedSections['AttributeDefinitions'],
) {
  if (!Array.isArray(v)) return v;
  return [...v].sort((a, b) =>
    String(a?.AttributeName ?? '').localeCompare(
      String(b?.AttributeName ?? ''),
    ),
  );
}

function canonicalizeKeySchema(v: GeneratedSections['KeySchema']) {
  if (!Array.isArray(v)) return v;
  const keyTypeOrder = (t: unknown) =>
    t === 'HASH' ? 0 : t === 'RANGE' ? 1 : 2;
  return [...v].sort((a, b) => {
    const ao = keyTypeOrder(a?.KeyType);
    const bo = keyTypeOrder(b?.KeyType);
    if (ao !== bo) return ao - bo;
    return String(a?.AttributeName ?? '').localeCompare(
      String(b?.AttributeName ?? ''),
    );
  });
}

function canonicalizeGsi(v: GeneratedSections['GlobalSecondaryIndexes']) {
  if (!Array.isArray(v)) return v;
  return [...v]
    .map((g) => {
      const keySchema = canonicalizeKeySchema(g?.KeySchema as never);
      const proj = g?.Projection as Record<string, unknown> | undefined;
      const nkaa = Array.isArray(proj?.NonKeyAttributes)
        ? [...(proj?.NonKeyAttributes as unknown[])].map(String).sort()
        : undefined;
      return {
        ...g,
        ...(keySchema ? { KeySchema: keySchema } : {}),
        ...(proj
          ? {
              Projection: {
                ...proj,
                ...(nkaa ? { NonKeyAttributes: nkaa } : {}),
              },
            }
          : {}),
      };
    })
    .sort((a, b) =>
      String(a?.IndexName ?? '').localeCompare(String(b?.IndexName ?? '')),
    );
}

function canonicalizeGenerated(sections: GeneratedSections): GeneratedSections {
  return {
    AttributeDefinitions: canonicalizeAttributeDefinitions(
      sections.AttributeDefinitions,
    ),
    KeySchema: canonicalizeKeySchema(sections.KeySchema),
    GlobalSecondaryIndexes: canonicalizeGsi(sections.GlobalSecondaryIndexes),
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export interface GeneratedDiff {
  key: string;
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
 * @param managed - Optional managed table properties to validate for drift.
 */
export async function validateGeneratedSections<C extends BaseConfigMap>(
  tablePath: string,
  em: EntityManager<C>,
  managed?: ManagedTablePropertiesInfo,
): Promise<ValidateResult> {
  const src = await fs.readFile(tablePath, 'utf8');
  const doc = YAML.parseDocument(src);

  const expected = canonicalizeGenerated(computeGeneratedSections(em));
  const actual = canonicalizeGenerated(pickGeneratedFromDoc(doc));

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

  if (managed) {
    const propsNode = doc.get('Properties');
    const props = YAML.parse(YAML.stringify(propsNode ?? {})) as Record<
      string,
      unknown
    >;

    // Enforce invariants implied by managed knobs against the effective YAML.
    assertManagedTablePropertiesInvariants({
      info: managed,
      effectiveProperties: props,
    });

    const actualManaged = pickManagedActualFromProperties(props);
    const expectedManaged = managed.managed;
    if (managed.manages.billingMode) {
      if (
        stableStringify(expectedManaged.BillingMode) !==
        stableStringify(actualManaged.BillingMode)
      ) {
        diffs.push({
          key: 'BillingMode',
          expected: expectedManaged.BillingMode,
          actual: actualManaged.BillingMode,
        });
      }
    }
    if (managed.manages.provisionedThroughput) {
      if (
        stableStringify(expectedManaged.ProvisionedThroughput) !==
        stableStringify(actualManaged.ProvisionedThroughput)
      ) {
        diffs.push({
          key: 'ProvisionedThroughput',
          expected: expectedManaged.ProvisionedThroughput,
          actual: actualManaged.ProvisionedThroughput,
        });
      }
    }
    if (managed.manages.tableName) {
      if (
        stableStringify(expectedManaged.TableName) !==
        stableStringify(actualManaged.TableName)
      ) {
        diffs.push({
          key: 'TableName',
          expected: expectedManaged.TableName,
          actual: actualManaged.TableName,
        });
      }
    }
  }

  return { equal: diffs.length === 0, diffs };
}
