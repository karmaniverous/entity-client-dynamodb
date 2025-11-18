import type { BatchGetOptions } from './BatchGetOptions';

/**
 * Options for EntityClient.getItems.
 * - removeKeys: when true and a token-aware overload is used, generated/global keys are removed from returned items.
 *   Without a token, removeKeys is ignored (no runtime error).
 */
export interface GetItemsOptions extends BatchGetOptions {
  removeKeys?: boolean;
}
