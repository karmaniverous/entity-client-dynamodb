/**
 * Small coercion helpers used by CLI option resolvers.
 *
 * Note: dotenv expansion is handled by get-dotenv helpers; this module is only for
 * precedence selection and numeric coercion.
 */

/**
 * Return the first defined value in precedence order.
 *
 * @typeParam T - Value type.
 * @param vals - Values in precedence order.
 * @returns The first defined value, or `undefined`.
 */
export const firstDefined = <T>(...vals: (T | undefined)[]): T | undefined =>
  vals.find((v) => v !== undefined);

/**
 * Coerce an unknown value to a finite number (accepts string input).
 *
 * @param v - Value to coerce.
 * @returns A finite number, or `undefined`.
 */
export const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return Number.isNaN(v) ? undefined : v;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
