# Interop — removeKeys‑literal typing for getItem/getItems

Purpose
- Enable precise, inference‑only DX for “records with keys” vs “items without keys” at call sites that already pass an entity token and a literal removeKeys flag.
- Downstream benefit: repository handlers can expose ergonomic overloads (keepKeys) without local casts or wrappers; most sites can call the client API directly.

Current behavior (summary)
- EntityClient.getItem(s) has token‑aware overloads that return a union:
  - With entityToken: `EntityRecordByToken<C, ET> | EntityItemByToken<C, ET>` (depending on removeKeys at runtime).
  - Without entityToken: `EntityRecord<C>` (broad).
- removeKeys?: boolean in options influences runtime shape, but types stay union‑y unless caller performs a narrow.

Problem
- When a caller passes a literal `removeKeys: true` or `removeKeys: false`, the return type should narrow correspondingly. Today it does not, so consumers either:
  - accept the union and add local narrowing code, or
  - use assertions.

Proposal — additive overloads (no runtime changes)

Token‑aware literal overloads for getItem
```ts
// With projection attributes
getItem<ET extends EntityToken<C>>(
  entityToken: ET,
  key: EntityKey<C>,
  attributes: string[],
  options: GetItemOptions & { removeKeys: true }
): Promise<
  ReplaceKey<GetCommandOutput, 'Item', EntityItemByToken<C, ET> | undefined>
>;

getItem<ET extends EntityToken<C>>(
  entityToken: ET,
  key: EntityKey<C>,
  attributes: string[],
  options: GetItemOptions & { removeKeys: false }
): Promise<
  ReplaceKey<GetCommandOutput, 'Item', EntityRecordByToken<C, ET> | undefined>
>;

// Without attributes array
getItem<ET extends EntityToken<C>>(
  entityToken: ET,
  key: EntityKey<C>,
  options: GetItemOptions & { removeKeys: true }
): Promise<
  ReplaceKey<GetCommandOutput, 'Item', EntityItemByToken<C, ET> | undefined>
>;

getItem<ET extends EntityToken<C>>(
  entityToken: ET,
  key: EntityKey<C>,
  options: GetItemOptions & { removeKeys: false }
): Promise<
  ReplaceKey<GetCommandOutput, 'Item', EntityRecordByToken<C, ET> | undefined>
>;
```

Token‑aware literal overloads for getItems
```ts
// With projection attributes
getItems<ET extends EntityToken<C>>(
  entityToken: ET,
  keys: EntityKey<C>[],
  attributes: string[],
  options: GetItemsOptions & { removeKeys: true }
): Promise<{
  items: EntityItemByToken<C, ET>[];
  outputs: BatchGetCommandOutput[];
}>;

getItems<ET extends EntityToken<C>>(
  entityToken: ET,
  keys: EntityKey<C>[],
  attributes: string[],
  options: GetItemsOptions & { removeKeys: false }
): Promise<{
  items: EntityRecordByToken<C, ET>[];
  outputs: BatchGetCommandOutput[];
}>;

// Without attributes array
getItems<ET extends EntityToken<C>>(
  entityToken: ET,
  keys: EntityKey<C>[],
  options: GetItemsOptions & { removeKeys: true }
): Promise<{
  items: EntityItemByToken<C, ET>[];
  outputs: BatchGetCommandOutput[];
}>;

getItems<ET extends EntityToken<C>>(
  entityToken: ET,
  keys: EntityKey<C>[],
  options: GetItemsOptions & { removeKeys: false }
): Promise<{
  items: EntityRecordByToken<C, ET>[];
  outputs: BatchGetCommandOutput[];
}>;
```

Notes and scope
- Keep existing overloads (with and without token) for backward compatibility:
  - Token‑aware non‑literal/unspecified removeKeys: return union (`…RecordByToken | …ItemByToken`).
  - Non‑token overloads: unchanged (broad shapes).
- No runtime behavior changes. The overloads only improve compile‑time inference when `removeKeys` is a literal.
- Implementation remains unified (varargs or a single impl signature is acceptable). Overloads must be ordered so literal‑flag signatures are checked before broader ones.

Projection interaction
- The attributes array controls DynamoDB projection; removeKeys governs post‑fetch stripping of generated/global keys only when the token‑aware form is used.
- When `removeKeys: true`, keys must not appear in the returned items even if projected by attributes (strip after projection).

Example — downstream usage (read helpers)
```ts
// records with keys
const recs = await entityClient.getItems('user', keys, { removeKeys: false });
// items without keys
const items = await entityClient.getItems('user', keys, { removeKeys: true });
```

Why this belongs in entity-client-dynamodb
- Token‑aware narrowing is already an advertised surface (ET). Consumers shouldn’t need a local wrapper to get rid of unions when they express intent (removeKeys) as a literal.
- This is purely an API typing enhancement; it centralizes a pattern many downstream repos will implement piecemeal otherwise.

Backward compatibility
- Additive only; no breakage expected:
  - Callers without a literal removeKeys or without a token keep current behavior.
  - Literal‑flag callers gain strong inference.
- Version: minor bump.

Implementation hints
- Keep the current unified implementation and overload only the signatures:
  - Normalize parameters internally (e.g., `function getItems(...args: any[]): Promise<any> { … }`).
  - Respect `options?.removeKeys` at runtime as today.
- Ensure literal overloads precede union ones so TypeScript selects them.
- For the `attributes` variants, preserve current projection behavior; stripping (when enabled) still runs after decoding.

Suggested tsd tests (compile‑time)
```ts
import { expectType } from 'tsd';

declare const client: EntityClient<MyCC>;
declare const keys: EntityKey<MyCC>[];

// Narrowing on true => items without keys
const r1 = await client.getItems('email', keys, { removeKeys: true });
expectType<Array<EntityItemByToken<MyCC, 'email'>>>(r1.items);

// Narrowing on false => records with keys
const r2 = await client.getItems('email', keys, { removeKeys: false });
expectType<Array<EntityRecordByToken<MyCC, 'email'>>>(r2.items);

// Non‑literal (fallback to union)
declare const flag: boolean;
const r3 = await client.getItems('email', keys, { removeKeys: flag });
expectType<Array<EntityItemByToken<MyCC, 'email'> | EntityRecordByToken<MyCC, 'email'>>>(r3.items);

// Without token (unchanged)
const r4 = await client.getItems(keys, { /* no token */ });
expectType<Array<EntityRecord<MyCC>>>(r4.items);
```

Optional runtime checks
- Keep existing integration tests green; no behavioral diffs expected.
- Optionally add a small test verifying that with `removeKeys: true` the returned items do not include hashKey/rangeKey, and `removeKeys: false` do include them.

Acceptance criteria
- When an entity token is provided and `removeKeys` is a literal `true`/`false`, return type narrows to `…ItemByToken[]` / `…RecordByToken[]` (and the single‑item `Item` variants in getItem).
- When `removeKeys` is dynamic or omitted, current union/broad types remain.
- No changes to runtime behavior; public API remains compatible.

Rationale
- This small typing enhancement completes the “schema‑ and value‑first, inference‑only DX” story: *intent at call‑site → precise types without casts.*
