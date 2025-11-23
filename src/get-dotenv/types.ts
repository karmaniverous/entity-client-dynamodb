/**
 * Versioned transform typing utilities for get-dotenv DynamoDB plugin.
 *
 * Requirements addressed:
 * - Handlers are per-entity (TransformMap only; no single catch-all).
 * - Handlers may be async and may have side effects (controlled by concurrency at call sites).
 * - Return conventions:
 *   • undefined → drop the record (do not migrate it).
 *   • single item/record → migrate one.
 *   • array of items/records → fan-out; migrate them all.
 *
 * Notes:
 * - Cross-entity fan-out is not supported in v1; outputs are interpreted for the same ET.
 * - These are authoring-time helpers; runtime composition lives in the plugin services.
 */

import type {
  BaseConfigMap,
  EntityItemByToken,
  EntityManager,
  EntityRecordByToken,
  EntityToken,
} from '@karmaniverous/entity-manager';

/**
 * Context passed to a transform handler for a specific entity token.
 */
export interface TransformContext<
  PrevCM extends BaseConfigMap,
  NextCM extends BaseConfigMap,
  ET extends EntityToken<PrevCM>,
> {
  /** EntityManager for the previous version (removes keys). */
  prev: EntityManager<PrevCM>;
  /** EntityManager for the next version (adds keys). */
  next: EntityManager<NextCM>;
  /** The entity token for this record. */
  entityToken: ET;
}

/**
 * A single transform handler for a specific entity token.
 *
 * Return:
 * - undefined → drop,
 * - item/record → migrate one,
 * - array of item/record → fan-out (migrate all).
 */
export type TransformHandler<
  PrevCM extends BaseConfigMap,
  NextCM extends BaseConfigMap,
  ET extends EntityToken<PrevCM>,
> = (
  record: EntityRecordByToken<PrevCM, ET>,
  ctx: TransformContext<PrevCM, NextCM, ET>,
) =>
  | undefined
  | EntityItemByToken<NextCM, ET>
  | EntityRecordByToken<NextCM, ET>
  | (EntityItemByToken<NextCM, ET> | EntityRecordByToken<NextCM, ET>)[]
  | Promise<
      | undefined
      | EntityItemByToken<NextCM, ET>
      | EntityRecordByToken<NextCM, ET>
      | (EntityItemByToken<NextCM, ET> | EntityRecordByToken<NextCM, ET>)[]
    >;

/**
 * A map of per-entity transform handlers.
 * Omitted entities use the default step (prev.removeKeys → next.addKeys).
 */
export type TransformMap<
  PrevCM extends BaseConfigMap,
  NextCM extends BaseConfigMap,
> = Partial<{
  [ET in EntityToken<PrevCM>]: TransformHandler<PrevCM, NextCM, ET>;
}>;

/**
 * Identity helper for authoring a TransformMap with strong inference.
 *
 * @example
 * export default defineTransformMap\<PrevCM, NextCM\>(\{
 *   user: async (record, \{ prev, next \}) =\> \{
 *     const item = prev.removeKeys('user', record);
 *     // mutate domain if needed...
 *     return next.addKeys('user', item);
 *   \},
 * \});
 */
export function defineTransformMap<
  PrevCM extends BaseConfigMap,
  NextCM extends BaseConfigMap,
>(map: TransformMap<PrevCM, NextCM>) {
  return map;
}
