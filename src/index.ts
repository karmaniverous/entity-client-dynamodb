export * from './EntityClient';
export * from './QueryBuilder';
export * from './Tables';

// DX: re-export commonly used types (types only; no runtime re-exports like EntityManager)
export type {
  EntityItemByToken,
  EntityRecordByToken,
  EntityToken,
} from '@karmaniverous/entity-manager';
// Re-export Projected type used in token-aware projection overloads
export type { Projected } from './EntityClient/EntityClient';
