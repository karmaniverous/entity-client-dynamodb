import { InvalidArgumentError } from '@commander-js/extra-typings';

/**
 * Build a Commander option parser that coerces a raw string to a finite number.
 *
 * @param label - Label used in error messages (e.g. `"port"`).
 * @returns Parser suitable for Commander `.option(..., parser)`.
 */
export const parseFiniteNumber =
  (label: string) =>
  (raw: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n))
      throw new InvalidArgumentError(`${label} must be a number`);
    return n;
  };

/**
 * Build a Commander option parser that coerces a raw string to a positive integer.
 *
 * @param label - Label used in error messages (e.g. `"maxSeconds"`).
 * @returns Parser suitable for Commander `.option(..., parser)`.
 */
export const parsePositiveInt =
  (label: string) =>
  (raw: string): number => {
    const n = parseFiniteNumber(label)(raw);
    if (!Number.isInteger(n) || n <= 0)
      throw new InvalidArgumentError(`${label} must be a positive integer`);
    return n;
  };

/**
 * Build a Commander option parser that coerces a raw string to a non-negative integer.
 *
 * @param label - Label used in error messages (e.g. `"limit"`).
 * @returns Parser suitable for Commander `.option(..., parser)`.
 */
export const parseNonNegativeInt =
  (label: string) =>
  (raw: string): number => {
    const n = parseFiniteNumber(label)(raw);
    if (!Number.isInteger(n) || n < 0)
      throw new InvalidArgumentError(`${label} must be a non-negative integer`);
    return n;
  };
