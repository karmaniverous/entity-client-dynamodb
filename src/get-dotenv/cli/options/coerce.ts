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

/**
 * Coerce one `--exclude-keys` value into key objects.
 *
 * Each value is JSON: either one key object (`{"hashKey2":"H","rangeKey":"1"}`)
 * or an array of them. Values are compared against stored keys as strings, so
 * numbers are converted rather than rejected.
 *
 * @param raw - One flag value, or several (repeatable flag).
 * @param label - Flag name, for error messages.
 * @returns Key objects (empty when nothing was passed).
 */
export const parseExcludeKeys = (
  raw: unknown,
  label = 'excludeKeys',
): Record<string, string>[] => {
  if (raw === undefined || raw === null) return [];

  const values = Array.isArray(raw) ? raw : [raw];
  const keys: Record<string, string>[] = [];

  for (const value of values) {
    let parsed: unknown = value;

    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error(`${label}: not valid JSON: ${value}`);
      }
    }

    const entries: unknown[] = Array.isArray(parsed)
      ? (parsed as unknown[])
      : [parsed];

    for (const entry of entries) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        Array.isArray(entry) ||
        !Object.keys(entry).length
      )
        throw new Error(
          `${label}: each entry must be a key object: ${JSON.stringify(entry)}`,
        );

      const key: Record<string, string> = {};

      for (const [attribute, attributeValue] of Object.entries(entry)) {
        if (
          typeof attributeValue !== 'string' &&
          typeof attributeValue !== 'number'
        )
          throw new Error(
            `${label}: attribute '${attribute}' must be a string or number: ${JSON.stringify(entry)}`,
          );

        key[attribute] = String(attributeValue);
      }

      keys.push(key);
    }
  }

  return keys;
};
