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

type GeneratedKey =
  | 'AttributeDefinitions'
  | 'KeySchema'
  | 'GlobalSecondaryIndexes';

type CanonicalGenerated = Record<GeneratedKey, unknown>;

interface AttrDefLike {
  AttributeName?: unknown;
}
interface KeySchemaLike {
  AttributeName?: unknown;
  KeyType?: unknown;
}
interface GsiLike {
  IndexName?: unknown;
  KeySchema?: unknown;
  Projection?: unknown;
}
interface ProjectionLike {
  NonKeyAttributes?: unknown;
}

function canonicalizeAttributeDefinitions(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return [...v].sort((a, b) => {
    const aName =
      a && typeof a === 'object' ? (a as AttrDefLike).AttributeName : undefined;
    const bName =
      b && typeof b === 'object' ? (b as AttrDefLike).AttributeName : undefined;
    return String(aName ?? '').localeCompare(String(bName ?? ''));
  });
}

function canonicalizeKeySchema(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  const keyTypeOrder = (t: unknown) =>
    t === 'HASH' ? 0 : t === 'RANGE' ? 1 : 2;
  return [...v].sort((a, b) => {
    const aObj = a && typeof a === 'object' ? (a as KeySchemaLike) : {};
    const bObj = b && typeof b === 'object' ? (b as KeySchemaLike) : {};
    const ao = keyTypeOrder(aObj.KeyType);
    const bo = keyTypeOrder(bObj.KeyType);
    if (ao !== bo) return ao - bo;
    return String(aObj.AttributeName ?? '').localeCompare(
      String(bObj.AttributeName ?? ''),
    );
  });
}

function canonicalizeGsi(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return [...v]
    .map((g) => {
      const gObj: Record<string, unknown> =
        g && typeof g === 'object' ? (g as Record<string, unknown>) : {};

      const keySchema = canonicalizeKeySchema((gObj as GsiLike).KeySchema);

      const projRaw = (gObj as GsiLike).Projection;
      const projObj =
        projRaw && typeof projRaw === 'object'
          ? (projRaw as Record<string, unknown>)
          : undefined;

      const nkaRaw = projObj
        ? (projObj as ProjectionLike).NonKeyAttributes
        : undefined;
      const nkaa = Array.isArray(nkaRaw)
        ? [...nkaRaw].map((x) => String(x)).sort()
        : undefined;

      return {
        ...gObj,
        ...(keySchema !== undefined ? { KeySchema: keySchema } : {}),
        ...(projObj
          ? {
              Projection: {
                ...projObj,
                ...(nkaa ? { NonKeyAttributes: nkaa } : {}),
              },
            }
          : {}),
      };
    })
    .sort((a, b) =>
      String((a as GsiLike).IndexName ?? '').localeCompare(
        String((b as GsiLike).IndexName ?? ''),
      ),
    );
}

function canonicalizeGenerated(
  sections: GeneratedSections,
): CanonicalGenerated {
  return {
    AttributeDefinitions: canonicalizeAttributeDefinitions(
      sections.AttributeDefinitions as unknown,
    ),
    KeySchema: canonicalizeKeySchema(sections.KeySchema as unknown),
    GlobalSecondaryIndexes: canonicalizeGsi(
      sections.GlobalSecondaryIndexes as unknown,
    ),
  };
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet();

  const normalize = (v: unknown, inArray: boolean): unknown => {
    if (v === undefined) return inArray ? null : undefined;
    if (v === null || typeof v !== 'object') return v;

    if (seen.has(v)) return '[Circular]';
    seen.add(v);

    if (Array.isArray(v)) return v.map((x) => normalize(x, true));

    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      const nv = normalize(obj[k], false);
      if (nv !== undefined) out[k] = nv;
    }
    return out;
  };

  const normalized = normalize(value, true);
  return JSON.stringify(normalized ?? null);
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
    const exp = expected[k];
    const act = actual[k];
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
