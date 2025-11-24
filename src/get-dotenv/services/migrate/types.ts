import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';

export interface Progress {
  pages: number;
  items: number;
  outputs: number;
  ratePerSec: number;
}

export interface MigrateOptions {
  fromVersion: string;
  toVersion: string;
  cfg?: unknown;
  pageSize?: number; // default 100
  limit?: number; // default Infinity
  transformConcurrency?: number; // default 1
  progressIntervalMs?: number; // default 2000
  sourceTableName?: string;
  targetTableName?: string;
  onProgress?: (p: Progress) => void;
}

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

export type TransformMapLike = Partial<Record<string, TransformHandler>>;

export interface StepContext {
  version: string;
  prev: EntityManager<BaseConfigMap>;
  next: EntityManager<BaseConfigMap>;
  transformMap: TransformMapLike; // normalized (missing entities => default chain)
}
