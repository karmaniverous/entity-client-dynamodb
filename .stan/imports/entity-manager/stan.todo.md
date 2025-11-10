# Development Plan

## Next up

- Verify CI picks up Vitest coverage artifacts (html/lcov) as expected.
- Review and prune any lingering Mocha/NYC references in docs or scripts.
- Optionally expand tsd tests to cover key exported types and generics.

## Completed (recent)

- Sharding: use full shard space per bump in hash key assignment
  - Fixed updateItemHashKey to use modulus (radix \*_ chars) instead of (chars _ radix),
    ensuring all placeholders are utilized for multi-character shard keys.
  - Added a unit test that verifies suffix selection spans the full shard space
    for chars > 1 by comparing against an expected base-radix suffix.

- Requirements: create authoritative stan.requirements.md
  - Extracted and formalized current implementation behavior (global config model,
    delimiters, sharding, page-key dehydration/rehydration, query orchestration).