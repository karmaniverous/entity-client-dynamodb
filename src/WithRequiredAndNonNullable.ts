export type WithRequiredAndNonNullable<T, K extends keyof T> = T & {
  [P in K]-?: NonNullable<T[P]>;
};
