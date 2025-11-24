import { pathToFileURL } from 'node:url';

import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';

import { resolveAndLoadEntityManager } from '../../emLoader';
import { resolveTransformFile, type VersionedLayoutConfig } from '../../layout';
import type { StepContext, TransformMapLike } from './types';

/** Load a TransformMap-like module (default export) for a version if present. */
export async function loadTransformMapForVersion(
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
export async function loadStepContext(
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
