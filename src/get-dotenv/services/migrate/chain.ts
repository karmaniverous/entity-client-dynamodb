import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';

import type { StepContext } from './types';

/** Default prev.removeKeys -\> next.addKeys chain (normalized to array). */
export function defaultChain(
  entityToken: string,
  record: Record<string, unknown>,
  prev: EntityManager<BaseConfigMap>,
  next: EntityManager<BaseConfigMap>,
): Record<string, unknown>[] {
  const item = prev.removeKeys(entityToken as never, record as never) as Record<
    string,
    unknown
  >;
  const nextRecord = next.addKeys(
    entityToken as never,
    item as never,
  ) as Record<string, unknown>;
  return [nextRecord];
}

/** Normalize a transform return to an array (drop/one/array). */
export function normalizeTransformReturn(
  value: undefined | Record<string, unknown> | Record<string, unknown>[],
): Record<string, unknown>[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Extract entity token from a storage record using prev EM config. */
export function extractEntityTokenFromRecord(
  record: Record<string, unknown>,
  prev: EntityManager<BaseConfigMap>,
): string {
  const hk = (prev.config as { hashKey?: string }).hashKey ?? 'hashKey';
  const delim =
    (prev.config as { shardKeyDelimiter?: string }).shardKeyDelimiter ?? '!';
  const value = record[hk];
  if (typeof value === 'string') {
    const idx = value.indexOf(delim);
    if (idx > -1) return value.slice(0, idx);
  }
  throw new Error('unable to extract entity token from record');
}

function assertStorageRecordMatchesEntityToken(args: {
  record: Record<string, unknown>;
  expectedEntityToken: string;
  em: EntityManager<BaseConfigMap>;
  stepVersion: string;
}): void {
  const { record, expectedEntityToken, em, stepVersion } = args;
  const actual = extractEntityTokenFromRecord(record, em);
  if (actual !== expectedEntityToken) {
    throw new Error(
      `transform output entity token mismatch in step ${stepVersion}: expected ${JSON.stringify(expectedEntityToken)} but got ${JSON.stringify(actual)} (cross-entity fan-out is not supported)`,
    );
  }
}

/** Apply a chain across steps, normalizing to storage records for the last EM. */
export async function applyStepChain(
  initial: Record<string, unknown>,
  stepContexts: StepContext[],
): Promise<Record<string, unknown>[]> {
  let acc: Record<string, unknown>[] = [initial];
  for (const ctx of stepContexts) {
    const { prev, next, transformMap } = ctx;
    const nextAcc: Record<string, unknown>[] = [];
    for (const rec of acc) {
      const entityToken = extractEntityTokenFromRecord(rec, prev);
      const handler = transformMap[entityToken];
      if (handler) {
        const val = await handler(rec, { prev, next, entityToken });
        const outs = normalizeTransformReturn(val);
        for (const out of outs) {
          const hk = (next.config as { hashKey?: string }).hashKey ?? 'hashKey';
          const rk =
            (next.config as { rangeKey?: string }).rangeKey ?? 'rangeKey';
          if (hk in out && rk in out) {
            assertStorageRecordMatchesEntityToken({
              record: out,
              expectedEntityToken: entityToken,
              em: next,
              stepVersion: ctx.version,
            });
            nextAcc.push(out);
          } else {
            nextAcc.push(next.addKeys(entityToken as never, out as never));
          }
        }
      } else {
        nextAcc.push(...defaultChain(entityToken, rec, prev, next));
      }
    }
    acc = nextAcc;
  }
  return acc;
}
