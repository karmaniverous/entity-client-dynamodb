export * from './EntityClient';
export type { ProcessEnv } from './ProcessEnv';
export * from './QueryBuilder';
export * from './Tables';

// DX: re-export commonly used types (types only; no runtime re-exports like EntityManager)
export type {
  EntityItem,
  EntityItemPartial,
  EntityRecord,
  EntityRecordPartial,
  EntityToken,
  Projected,
} from '@karmaniverous/entity-manager';
