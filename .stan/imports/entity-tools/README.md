# Entity Tools

[![npm version](https://img.shields.io/npm/v/@karmaniverous/entity-tools.svg)](https://www.npmjs.com/package/@karmaniverous/entity-tools) ![Node Current](https://img.shields.io/node/v/@karmaniverous/entity-tools) <!-- TYPEDOC_EXCLUDE --> [![docs](https://img.shields.io/badge/docs-website-blue)](https://docs.karmanivero.us/entity-tools) [![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/entity-tools/tree/main/CHANGELOG.md)<!-- /TYPEDOC_EXCLUDE --> [![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/entity-tools/tree/main/LICENSE.md)

Entity Tools provides a compact set of runtime utilities and type-level helpers for working with data models (Entities), sorting, shallow updates, and safe transcoding between values and lexicographically sortable strings.

- Small surface area, zero runtime dependencies beyond radash.
- Strong TypeScript support with dedicated type tests (tsd).
- Works great standalone or together with:
  - [entity-manager](https://github.com/karmaniverous/entity-manager)
  - [entity-client-dynamodb](https://github.com/karmaniverous/entity-client-dynamodb)
  - [mock-db](https://github.com/karmaniverous/mock-db)

## Installation

```bash
npm i @karmaniverous/entity-tools
# or: pnpm add @karmaniverous/entity-tools
# or: yarn add @karmaniverous/entity-tools
```

## Exports overview

Runtime utilities

- conditionalize(fn, condition?): wrap a function so it only runs when condition is truthy; otherwise returns undefined.
- defaultTranscodes: ready-made Transcodes supporting the DefaultTranscodeRegistry (boolean, string, number, fix6, int, bigint, bigint20, timestamp).
- isNil(value): Nil type-guard (null | undefined).
- sort(items, sortOrder): stable, progressive sort over Entity properties (numbers, strings, bigints, null/undefined, and truthiness fallback).
- updateItem(record, update): shallow update that ignores undefined, assigns nulls, and removes null/undefined from the result.

Core types (entities and sorting)

- Entity: base Record<string, unknown> you can extend for your models.
- EntityMap: map of named entities.
- Exactify<T>: strip index signatures from records.
- EntityKeys<E>, EntityValue<E, K>, EntityMapValues<M>, FlattenEntityMap<M>
- SortOrder<E>: sort descriptor for sort().

Transcoding types

- TranscodeRegistry (canonical): relates transcode keys to the types they encode (e.g., `int → number`).
- DefaultTranscodeRegistry: a concrete TranscodeRegistry shipped by this package.
- Transcodes<TR>: shape of an encode/decode registry for a TranscodeRegistry.
- TranscodeRegistryFrom<T>: derives a TranscodeRegistry type from a record of transcoders by mapping each key to ReturnType<decode>.
- TranscodedType<TR, TN>, TranscodeName<TR>

Type utilities

- ConditionalProperty<K, C, O>, MakeOptional<T, K>, MakeRequired<T, K>, MakeUpdatable<T, K>, WithRequiredAndNonNullable<T, K>
- AllDisjoint<First, Rest>, MutuallyExclusive<T>
- NotNever<T, Keys>, PropertiesOfType<O, T>, PropertiesNotOfType<O, T>
- ReplaceKey<T, K, R>, ReplaceKeys<T, R>
- Nil (type alias for null | undefined)

Full reference: see API docs linked at the top of this README.

## Quick examples

Sorting

```ts
import { sort, type SortOrder } from '@karmaniverous/entity-tools';

type User = {
  id: number;
  name: string;
  optional?: string | null;
  data?: object;
};
const users: User[] = [
  { id: 2, name: 'Adam', optional: 'foo', data: { foo: 'bar' } },
  { id: 3, name: 'Bob', optional: 'bar', data: { bar: 'baz' } },
  { id: 1, name: 'Charlie', optional: null, data: { baz: 'qux' } },
  { id: 4, name: 'Adam' },
];

const order: SortOrder<User> = [
  { property: 'name' },
  { property: 'id', desc: true },
];
const result = sort(users, order);
// [
//   { id: 4, name: 'Adam' },
//   { id: 2, name: 'Adam', optional: 'foo', data: { foo: 'bar' } },
//   { id: 3, name: 'Bob', optional: 'bar', data: { bar: 'baz' } },
//   { id: 1, name: 'Charlie', optional: null, data: { baz: 'qux' } },
// ]
```

Shallow updates

```ts
import { updateItem } from '@karmaniverous/entity-tools';

const original = {
  id: 1,
  name: 'Alice',
  note: undefined as string | undefined,
};
const patch = {
  name: 'Alicia',
  note: null,
  extra: undefined as string | undefined,
};

const updated = updateItem(original, patch);
// { id: 1, name: 'Alicia' }  // note and extra are removed (null/undefined stripped)
```

Conditional execution

```ts
import { conditionalize } from '@karmaniverous/entity-tools';

const debugLog = conditionalize(console.log, process.env.DEBUG);
debugLog?.('only logs when DEBUG is truthy');
```

Nil checks

```ts
import { isNil, type Nil } from '@karmaniverous/entity-tools';

function takesMaybe(v: unknown): v is Nil {
  return isNil(v);
}
```

## Transcoding

### Inference-first builder (defineTranscodes)

The builder is value-first and inference-first: pass a literal registry and get a strongly-typed `Transcodes<…>` back with strict agreement between `encode` and `decode` per key.

```ts
import { defineTranscodes } from '@karmaniverous/entity-tools';
import type {
  Transcodes,
  TranscodeRegistryFrom,
  TranscodedType,
  TranscodeName,
} from '@karmaniverous/entity-tools';

const mySpec = {
  int: {
    encode: (v: number) => v.toString(),
    decode: (s: string) => Number(s),
  },
  boolean: {
    encode: (v: boolean) => (v ? 't' : 'f'),
    decode: (s: string) => s === 't',
  },
} as const;

// Build the runtime registry (inference-first)
const myTranscodes = defineTranscodes(mySpec);
//    ^? Transcodes<TranscodeRegistryFrom<typeof mySpec>>

// Extract the registry type without building:
type MyRegistry = TranscodeRegistryFrom<typeof mySpec>;
// Name and value helpers
type TInt = TranscodedType<MyRegistry, 'int'>; // number
type TNames = TranscodeName<MyRegistry>; // 'int' | 'boolean'
```

Agreement is enforced at compile time: if `encode` and `decode` disagree for any key, the spec becomes unsatisfiable and TypeScript will error.

```ts
import { defineTranscodes } from '@karmaniverous/entity-tools';

// @ts-expect-error encode/decode types do not agree
defineTranscodes({
  bad: {
    encode: (_v: unknown) => '',
    // wrong decode return type on purpose:
    decode: (_s: string) => 'oops',
  },
} as const);
```

### Branded error shapes (clearer type errors)

To improve DX, unsatisfied keys are branded in the agreement type so the compiler produces clearer error messages during development:

- Missing encode function:
  - `{ __error__: 'MissingEncode'; key: K }`
- Missing decode function:
  - `{ __error__: 'MissingDecode'; key: K }`
- Mismatch (encode/decode disagreement):
  - `{ __error__: 'EncodeDecodeMismatch'; key: K; encodeParam: VK; decodeReturn: VK' }`

These branded shapes are used by the agreement type internally; the builder still rejects invalid specs, but the branded shapes help the compiler show more actionable messages when a spec is incorrect.

Example (type-only):

```ts
import type {
  EncodeDecodeAgreement,
  EncodeDecodeMismatchError,
} from '@karmaniverous/entity-tools';

// Produces a branded mismatch error for key 'bad'
type Mismatch = EncodeDecodeAgreement<{
  bad: { encode: (v: number) => string; decode: (s: string) => boolean };
}>;

// Assignable to a branded error shape:
const sample: EncodeDecodeMismatchError<'bad', number, boolean> = {
  __error__: 'EncodeDecodeMismatch',
  key: 'bad',
  encodeParam: 1 as number,
  decodeReturn: true as boolean,
};
```

### Notes on default transcoding

- Keys supported by DefaultTranscodeRegistry:
  - boolean → "t"/"f" (fixed width)
  - string → identity (variable width)
  - number → decimal string (variable width)
  - fix6 → signed fixed width with 6 decimals, padded; sorts lexicographically
  - int → signed fixed-width integer, padded; sorts lexicographically
  - bigint → decimal string (variable width)
  - bigint20 → signed fixed-width BigInt up to 20 digits; sorts lexicographically
  - timestamp → fixed-width 13-digit UNIX millis, padded
- Encoders throw on invalid inputs; decoders throw on invalid encoded strings.
- For custom maps, define your own TranscodeRegistry using defineTranscodes (inference-first).

### Quick examples

```ts
import { defaultTranscodes } from '@karmaniverous/entity-tools';

// Fixed-width integer (sign-prefixed, zero-padded; sorts lexicographically)
const enc = defaultTranscodes.int.encode(-123); // "n0000000000000123"
const dec = defaultTranscodes.int.decode(enc); // -123

// Fixed 6-decimal number
defaultTranscodes.fix6.encode(123.45); // "p0000000123.450000"
defaultTranscodes.fix6.decode('n0000000123.450000'); // -123.45

// Variable width number, boolean, string
defaultTranscodes.number.encode(42); // "42"
defaultTranscodes.boolean.decode('t'); // true
defaultTranscodes.string.encode('hello'); // "hello"

// BigInt (variable) and BigInt20 (fixed width up to 20 digits)
defaultTranscodes.bigint.encode(1234567890123456789n); // "1234567890123456789"
defaultTranscodes.bigint20.encode(-1234567890123456789n); // "n01234567890123456789"
```

## KV codec helpers

```ts
import { encodePairs, decodePairs } from '@karmaniverous/entity-tools';

const pairs: Array<[string, string]> = [
  ['k1', 'v1'],
  ['k2', ''],
];
const enc = encodePairs(pairs); // 'k1#v1|k2#'
const dec = decodePairs(enc); // pairs

// custom delimiters
const enc2 = encodePairs(pairs, { pair: '~', kv: '::' }); // 'k1::v1~k2::'
const dec2 = decodePairs(enc2, { pair: '~', kv: '::' }); // pairs
```

## Sharding math helpers

```ts
import {
  hashString,
  enumerateShardSuffixes,
  shardSuffixFromHash,
} from '@karmaniverous/entity-tools';

// hashString: deterministic 32-bit unsigned FNV-1a
const h = hashString('hello'); // number in [0, 2^32 - 1]

// enumerateShardSuffixes: all suffixes for radix/width
const hex2 = enumerateShardSuffixes(16, 2); // ['00', '01', ..., 'ff']

// shardSuffixFromHash: modulo shard space with padding
const s = shardSuffixFromHash(h, 16, 2); // e.g., 'a3'
```

## Type-only helpers (samples)

```ts
import type {
  MakeOptional,
  MakeRequired,
  MakeUpdatable,
  WithRequiredAndNonNullable,
  MutuallyExclusive,
  PropertiesOfType,
  PropertiesNotOfType,
  ReplaceKey,
  ReplaceKeys,
} from '@karmaniverous/entity-tools';

type User = { id: number; name: string; note?: string | null };
type OptionalNote = MakeOptional<User, 'note'>;
type RequiredId = WithRequiredAndNonNullable<User, 'id'>;

// Compile-time exclusivity check (returns true or an error-shape).
type Ex = MutuallyExclusive<['a', 'b' | 'c', 'd']>; // true
```

---

Built for you with ❤️ on Bali! Find more great tools & templates on [my GitHub Profile](https://github.com/karmaniverous).
