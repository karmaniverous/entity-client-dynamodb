# Development Plan

## Next up

- Verify CI picks up Vitest coverage artifacts (html/lcov) as expected.
- Review and prune any lingering Mocha/NYC references in docs or scripts.
- Optionally expand tsd tests to cover key exported types and generics.

## Completed (recent)

- EntityManager.getPrimaryKey returns arrays and supports no-timestamp items
  - Changed getPrimaryKey to always return EntityKey[].
  - If overwrite=false and both hashKey and rangeKey are present on the item,
    return that single pair.
  - Otherwise, compute rangeKey; when timestampProperty is present, compute a
    single hashKey and return one key. When timestampProperty is missing, enumerate
    the hash-key space across all shard bumps (0..Infinity) and return one key per
    bump (uniqueProperty present narrows to one suffix per bump).
  - For array inputs, results are flattened into a single list.
  - Added unit tests: single item (timestamp/no timestamp), array flattening,
    honoring pre-populated keys with overwrite=false, and throwing when unique
    property is missing.
  - Amendment: Fixed test typing by using static keys (`hashKey2`, `rangeKey`)
    instead of dynamic string indexing to satisfy TS7053 and ESLint rules.

- Shard-space narrowing based on uniqueProperty presence
  - getHashKeySpace now automatically constrains to exactly one shard suffix    per bump when the item's uniqueProperty is present (non-null/undefined),
    for both global and sharded hash keys. Otherwise it enumerates the full
    shard space (unchanged).
  - Alternate sharded keys still require appropriate elements; missing
    elements continue to throw via encodeGeneratedProperty.
  - Note: pagination requires consistent presence/absence of uniqueProperty
    across pages; otherwise dehydrated/rehydrated page-key lengths will
    mismatch by design.

- Sharding: use full shard space per bump in hash key assignment
  - Fixed updateItemHashKey to use modulus (radix \*_ chars) instead of (chars _ radix),
    ensuring all placeholders are utilized for multi-character shard keys.
  - Added a unit test that verifies suffix selection spans the full shard space
    for chars > 1 by comparing against an expected base-radix suffix.

- Requirements: create authoritative stan.requirements.md
  - Extracted and formalized current implementation behavior (global config model,
    delimiters, sharding, page-key dehydration/rehydration, query orchestration).