/**
 * Migrate data across versioned steps (prev to next) with optional per-step transforms.
 *
 * Requirements addressed:
 * - Step discovery: enumerate all versions where fromVersion \< k \<= toVersion in ascending order.
 * - EM resolution per step with fallback (walk backward) for both prev and next.
 * - Transform loading per step (optional). Missing transforms use the default chain.
 * - Default chain: prev.removeKeys followed by next.addKeys.
 * - Transform semantics: undefined results in drop; single result produces one output; array produces fan-out.
 * - Streaming scan with Limit=pageSize; writes via target.putItems.
 * - Counters and progress callback at interval.
 * - Limit/stop conditions respected; minimal memory footprint (page-bounded).
 */

import { pathToFileURL } from 'node:url';

import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';

import type { EntityClient } from '../../EntityClient/EntityClient';
import { resolveAndLoadEntityManager } from '../emLoader';
import {
  enumerateStepVersions,
  resolveTransformFile,
  resolveVersionDir,
  type VersionedLayoutConfig,
} from '../layout';

export interface Progress {
  pages: number;
  items: number;
  outputs: number;
  ratePerSec: number;
}

export interface MigrateOptions {
  fromVersion: string;
  toVersion: string;
  cfg?: VersionedLayoutConfig;
  pageSize?: number; // default 100
  limit?: number; // default Infinity
  transformConcurrency?: number; // default 1
  progressIntervalMs?: number; // default 2000
  sourceTableName?: string;
  targetTableName?: string;
  onProgress?: (p: Progress) => void;
}

type TransformHandler = (
  record: Record<string, unknown>,
  ctx: {
    prev: EntityManager<BaseConfigMap>;
    next: EntityManager<BaseConfigMap>;
    entityToken: string;
  },
) =>
  | undefined
  | Record<string, unknown>
  | Record<string, unknown>[]
  | Promise<undefined | Record<string, unknown> | Record<string, unknown>[]>;

type TransformMapLike = Partial<Record<string, TransformHandler>>;

interface StepContext {
  version: string;
  prev: EntityManager<BaseConfigMap>;
  next: EntityManager<BaseConfigMap>;
  transformMap: TransformMapLike; // normalized (missing entities => default chain)
}

/** Default prev.removeKeys followed by next.addKeys (normalized to array). */
function defaultChain(
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
function normalizeTransformReturn(
  value: undefined | Record<string, unknown> | Record<string, unknown>[],
): Record<string, unknown>[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Load a TransformMap-like module (default export) for a version if present. */
async function loadTransformMapForVersion(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<TransformMapLike | undefined> {
  const file = await resolveTransformFile(version, cfg);
  if (!file) return undefined;
  const mod: unknown = await import(pathToFileURL(file).href);
  const exp =
    mod &&
    typeof mod === 'object' &&
    'default' in (mod as Record<string, unknown>)
      ? (mod as { default: unknown }).default
      : mod;
  if (exp && typeof exp === 'object') return exp as TransformMapLike;
  return undefined;
}

/** Resolve per-step context: prev EM, next EM, transform map (optional). */
async function loadStepContext(
  prevHintVersion: string,
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<StepContext> {
  const prev = await resolveAndLoadEntityManager(prevHintVersion, cfg);
  const next = await resolveAndLoadEntityManager(version, cfg);
  const transformMap = (await loadTransformMapForVersion(version, cfg)) ?? {};
  return {
    version,
    prev: prev as unknown as EntityManager<BaseConfigMap>,
    next: next as unknown as EntityManager<BaseConfigMap>,
    transformMap,
  };
}

/** Extract entity token from a storage record using prev EM config. */
function extractEntityTokenFromRecord(
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

/** Apply the chain across steps, normalizing to storage records for the last EM. */
async function applyStepChain(
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
        // ensure storage records for next by adding keys if necessary
        for (const out of outs) {
          const hk = (next.config as { hashKey?: string }).hashKey ?? 'hashKey';
          const rk =
            (next.config as { rangeKey?: string }).rangeKey ?? 'rangeKey';
          if (hk in out && rk in out) {
            nextAcc.push(out);
          } else {
            const norm = next.addKeys(
              entityToken as never,
              out as never,
            ) as Record<string, unknown>;
            nextAcc.push(norm);
          }
        }
      } else {
        const outs = defaultChain(entityToken, rec, prev, next);
        nextAcc.push(...outs);
      }
    }
    acc = nextAcc;
  }
  return acc;
}

/** Run a simple concurrency-limited task pool. */
async function runLimited<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  let running = 0;
  return new Promise((resolveDone, reject) => {
    const startNext = () => {
      while (running < limit && index < tasks.length) {
        const i = index++;
        running++;
        tasks[i]()
          .then((res) => {
            results[i] = res;
          })
          .catch(reject)
          .finally(() => {
            running--;
            if (
              results.length === tasks.length &&
              running === 0 &&
              index >= tasks.length
            ) {
              resolveDone(results);
            } else {
              startNext();
            }
          });
      }
      if (tasks.length === 0) resolveDone(results);
    };
    startNext();
  });
}

export async function migrateData<C extends BaseConfigMap>(
  source: EntityClient<C>,
  target: EntityClient<C>,
  options: MigrateOptions,
): Promise<{ pages: number; items: number; outputs: number }> {
  const {
    fromVersion,
    toVersion,
    cfg,
    pageSize = 100,
    limit = Number.POSITIVE_INFINITY,
    transformConcurrency = 1,
    progressIntervalMs = 2000,
    sourceTableName = source.tableName,
    targetTableName = target.tableName,
    onProgress,
  } = options;

  // Version existence guard (never silently no-op).
  await resolveVersionDir(fromVersion, cfg, { mustExist: true });
  await resolveVersionDir(toVersion, cfg, { mustExist: true });

  // Build step list
  const steps = await enumerateStepVersions(fromVersion, toVersion, cfg);
  const stepContexts: StepContext[] = [];
  let prevHint = fromVersion;
  for (const ver of steps) {
    const ctx = await loadStepContext(prevHint, ver, cfg);
    stepContexts.push(ctx);
    prevHint = ver;
  }

  // Counters and progress ticker
  let pages = 0;
  let items = 0;
  let outputs = 0;
  let windowStart = Date.now();
  let windowOutputs = 0;
  const maybeTick = () => {
    if (!onProgress) return;
    const now = Date.now();
    if (now - windowStart >= progressIntervalMs) {
      const ratePerSec = windowOutputs / ((now - windowStart) / 1000) || 0;
      onProgress({ pages, items, outputs, ratePerSec });
      windowStart = now;
      windowOutputs = 0;
    }
  };

  let exclusiveStartKey: Record<string, unknown> | undefined = undefined;
  outer: for (;;) {
    const scanOut = await source.doc.scan({
      TableName: sourceTableName,
      ExclusiveStartKey: exclusiveStartKey as never,
      Limit: pageSize,
    });
    const pageItems = (scanOut.Items ?? []) as Record<string, unknown>[];
    exclusiveStartKey = scanOut.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
    pages++;
    items += pageItems.length;

    // Transform with optional concurrency
    const tasks = pageItems.map(
      (rec) => async () => applyStepChain(rec, stepContexts),
    );
    const transformed = await runLimited(
      tasks,
      Math.max(1, transformConcurrency),
    );
    let flat = transformed.flat();

    // Enforce limit when provided
    if (Number.isFinite(limit)) {
      const remaining = limit - outputs;
      if (remaining <= 0) break outer;
      if (flat.length > remaining) {
        flat = flat.slice(0, remaining);
      }
    }

    if (flat.length > 0) {
      await target.putItems(
        flat as never,
        { tableName: targetTableName } as never,
      );
      outputs += flat.length;
      windowOutputs += flat.length;
    }

    maybeTick();
    if (!exclusiveStartKey) break outer;
  }

  // Final progress tick
  if (onProgress) {
    const now = Date.now();
    const ratePerSec =
      windowOutputs / Math.max(1, (now - windowStart) / 1000) || 0;
    onProgress({ pages, items, outputs, ratePerSec });
  }

  return { pages, items, outputs };
}
