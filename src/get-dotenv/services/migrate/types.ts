import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';

import type { VersionedLayoutConfig } from '../../layout';

/**
 * Progress counters emitted by {@link migrateData | `migrateData`}.
 *
 * @category get-dotenv
 */
export interface Progress {
  /** Number of scan pages read from the source table. */
  pages: number;
  /** Number of source items processed. */
  items: number;
  /** Number of output records written to the target table. */
  outputs: number;
  /** Rolling write rate in outputs/sec (windowed). */
  ratePerSec: number;
}

/**
 * Options for {@link migrateData | `migrateData`}.
 *
 * @category get-dotenv
 */
export interface MigrateOptions {
  /** Source version (exclusive). */
  fromVersion: string;
  /** Target version (inclusive). */
  toVersion: string;
  /** Versioned layout configuration (tablesPath, tokens, width). */
  cfg?: VersionedLayoutConfig;
  /** DynamoDB scan page size (default 100). */
  pageSize?: number;
  /** Max outputs to write (default Infinity). */
  limit?: number;
  /** Transform concurrency within a page (default 1). */
  transformConcurrency?: number;
  /** Progress tick interval in ms (default 2000). */
  progressIntervalMs?: number;
  /** Optional source table name override. */
  sourceTableName?: string;
  /** Optional target table name override. */
  targetTableName?: string;
  /** Optional progress callback (invoked on a timer). */
  onProgress?: (p: Progress) => void;
}

/**
 * Transform handler contract used by per-step transforms (runtime-facing).
 *
 * @category get-dotenv
 */
export type TransformHandler = (
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

/**
 * Map of entityToken to transform handler for a single version step.
 *
 * @category get-dotenv
 */
export type TransformMapLike = Partial<Record<string, TransformHandler>>;

/**
 * Resolved per-step context (prev/next EM + transform map).
 *
 * @category get-dotenv
 */
export interface StepContext {
  /** Step version token (NNN). */
  version: string;
  /** Resolved EntityManager for the previous version (fallback-aware). */
  prev: EntityManager<BaseConfigMap>;
  /** Resolved EntityManager for the next version (fallback-aware). */
  next: EntityManager<BaseConfigMap>;
  /** Transform map for this step; missing handlers use the default chain. */
  transformMap: TransformMapLike; // normalized (missing entities => default chain)
}
