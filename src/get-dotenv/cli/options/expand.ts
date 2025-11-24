import type { EnvRef } from './types';

/** Expand $VAR[:default] and ${VAR[:default]} recursively against ref. */
export function dotenvExpandLocal(
  value: string | undefined,
  ref: EnvRef = process.env,
): string | undefined {
  if (value === undefined) return undefined;
  let out = value;
  // Iterate until stable or small safety cap.
  for (let i = 0; i < 8; i++) {
    const before = out;
    // ${VAR[:default]}
    out = out.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::([^}]*))?\}/g,
      (_m, k: string, dflt?: string) => {
        const v = ref[k];
        return v ?? dflt ?? '';
      },
    );
    // $VAR[:default]
    out = out.replace(
      /\$([A-Za-z_][A-Za-z0-9_]*)(?::([^\s$]+))?/g,
      (_m, k: string, dflt?: string) => {
        const v = ref[k];
        return v ?? dflt ?? '';
      },
    );
    if (out === before) break;
  }
  return out;
}

/** Expand string leaves of a shallow object using ref; optionally progressive. */
export function dotenvExpandAllLocal<T extends Record<string, unknown>>(
  values: T | undefined,
  ref: EnvRef = process.env,
  progressive = false,
): T {
  const out: Record<string, unknown> = {};
  if (!values) return out as T;
  const localRef: EnvRef = progressive ? { ...ref } : ref;
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string') {
      const expanded = dotenvExpandLocal(v, localRef);
      out[k] = expanded;
      if (progressive && expanded !== undefined) localRef[k] = expanded;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** Merge in precedence order (first defined wins). */
export const firstDefined = <T>(...vals: (T | undefined)[]): T | undefined =>
  vals.find((v) => v !== undefined);

/** Coerce to number when present; tolerate string input. */
export const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return Number.isNaN(v) ? undefined : v;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
