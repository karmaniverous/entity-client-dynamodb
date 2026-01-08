import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import { parallel } from 'radash';

import type { EntityClient } from '../../../EntityClient/EntityClient';
import {
  enumerateStepVersions,
  resolveVersionDir,
  type VersionedLayoutConfig,
} from '../../layout';
import { applyStepChain } from './chain';
import { loadStepContext } from './load';
import type { StepContext } from './types';

/**
 * Result returned by {@link migrateData | `migrateData`}.
 *
 * @category get-dotenv
 */
export interface MigrateDataResult {
  /** Number of scan pages processed. */
  pages: number;
  /** Number of source items processed. */
  items: number;
  /** Number of output records written to the target table. */
  outputs: number;
}

/**
 * Migrate data across versioned steps with optional per-step transforms.
 *
 * @category get-dotenv
 */
export async function migrateData<C extends BaseConfigMap>(
  source: EntityClient<C>,
  target: EntityClient<C>,
  options: {
    fromVersion: string;
    toVersion: string;
    cfg?: VersionedLayoutConfig;
    pageSize?: number;
    limit?: number;
    transformConcurrency?: number;
    progressIntervalMs?: number;
    sourceTableName?: string;
    targetTableName?: string;
    onProgress?: (p: {
      pages: number;
      items: number;
      outputs: number;
      ratePerSec: number;
    }) => void;
  },
): Promise<MigrateDataResult> {
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

  // Scan→transform→write loop
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
    const transformed = await parallel(
      Math.max(1, transformConcurrency),
      pageItems,
      (rec) => applyStepChain(rec, stepContexts),
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
