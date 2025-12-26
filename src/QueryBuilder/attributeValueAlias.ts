import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz',
  8,
);

/**
 * Generate a unique DynamoDB ExpressionAttributeValues alias (e.g. `:Abc123_x`).
 *
 * @returns Alias string suitable for use as a key in `ExpressionAttributeValues`.
 *
 * @category QueryBuilder
 */
export const attributeValueAlias = () => `:${nanoid()}`;
