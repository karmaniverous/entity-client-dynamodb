/**
 * Returns an object type with specific properties rendered required and non-nullable.
 *
 * @typeParam T - The object type to modify.
 * @typeParam K - Union of keys of `T` to render required and non-nullable.
 */
export type WithRequiredAndNonNullable<T, K extends keyof T> = T & {
  [P in K]-?: NonNullable<T[P]>;
};
