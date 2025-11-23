/**
 * EntityManager dynamic loader for versioned layout.
 *
 * Requirements addressed:
 * - Resolve entityManager module path per version with fallback (walk backward).
 * - Dynamically import the module (default export is an EM instance or a factory).
 * - Keep EntityClient pure (no dynamic resolution inside EntityClient).
 *
 * Notes:
 * - This module does not cache; callers may cache results if desired.
 * - TS modules may require a bundler/transpiler upstream; when executed under Node,
 *   .js files should work directly, while .ts imports depend on runtime environment.
 */

import { pathToFileURL } from 'node:url';

import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';

import {
  resolveEntityManagerFileWithFallback,
  type VersionedLayoutConfig,
} from './layout';

/** Minimal structural guard to sanity check the loaded EM. */
function isEntityManagerLike(value: unknown): value is { config: unknown } {
  return !!value && typeof value === 'object' && 'config' in value;
}

/**
 * Load an EntityManager from a module path. Supports default export as:
 * - an EntityManager instance, or
 * - a factory function returning an EntityManager (sync or async).
 */
export async function loadEntityManagerFromFile(
  modulePath: string,
): Promise<EntityManager<BaseConfigMap>> {
  const url = pathToFileURL(modulePath).href;
  const mod: unknown = await import(url);
  let exp: unknown;
  if (
    typeof mod === 'object' &&
    mod !== null &&
    'default' in (mod as Record<string, unknown>)
  ) {
    exp = (mod as { default: unknown }).default;
  } else {
    exp = mod;
  }

  let em: unknown;
  if (typeof exp === 'function') {
    em = await (exp as () => unknown)();
  } else {
    em = exp;
  }

  if (!isEntityManagerLike(em)) {
    throw new Error(
      `invalid EntityManager module export at ${modulePath} (expected default EM instance or factory)`,
    );
  }

  return em as EntityManager<BaseConfigMap>;
}

/**
 * Resolve and load an EntityManager for a version with fallback (walk backward).
 * Throws if none can be resolved for the ancestry.
 */
export async function resolveAndLoadEntityManager(
  version: string,
  cfg?: VersionedLayoutConfig,
): Promise<EntityManager<BaseConfigMap>> {
  const file = await resolveEntityManagerFileWithFallback(version, cfg);
  if (!file) {
    throw new Error(
      `no entityManager module found for version ${version} or any earlier version under ${cfg?.tablesPath ?? 'tables'}`,
    );
  }
  return loadEntityManagerFromFile(file);
}
