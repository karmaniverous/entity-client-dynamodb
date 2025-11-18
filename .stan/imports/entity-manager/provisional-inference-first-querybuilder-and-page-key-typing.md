# Interop (Provisional) — Inference‑first generics for QueryBuilder and page keys (entity-client-dynamodb)

Status
- Provisional. This note will be updated after the entity-tools and entity-manager refactors are complete and published.

Purpose
- Align entity-client-dynamodb with the inference‑first, token/index‑aware types adopted in entity-manager.
- Improve DX by narrowing query inputs/outputs by entity token (ET) and index token (IT/ITS) without casts.
- Keep runtime behavior unchanged.

Strict acronyms to adopt (match entity-manager)
- CC — CapturedConfig
- EM — EntityMap
- E — Entity
- ET — EntityToken
- EOT — EntityOfToken
- TR — TranscodeRegistry
- TN — TranscodeName
- HKT — HashKeyToken
- RKT — RangeKeyToken
- SGKT — ShardedGeneratedKeyToken
- UGKT — UnshardedGeneratedKeyToken
- PT — PropertyToken
- IT — IndexToken
- ITS — IndexTokenSubset
- EIBT — EntityItemByToken
- ERBT — EntityRecordByToken
- PKBI — PageKeyByIndex
- PKMBIS — PageKeyMapByIndexSet
- SQFBI — ShardQueryFunctionByIndex
- QO — QueryOptions (from entity-manager)
- QR — QueryResult (from entity-manager)
- PK — PropertyKey
- V — Value

Ordering for public APIs
1) CC
2) EM
3) TR (TN only if necessary)
4) ET
5) IT / ITS
6) PK / V

Required (provisional) refactors
1) QueryBuilder generics
- QueryBuilder<CC, EM, ET extends keyof EM, ITS extends ITSubsetForEntity<CC, EM, ET>>
  - Holds entityManager: EntityManager<CC, EM>.
  - build(): Partial<Record<ITS, SQFBI<CC, EM, ET, ITS>>> — builds a shard query map keyed by the selected index tokens.
  - query(options: QO<CC, EM, ET, ITS>): Promise<QR<CC, EM, ET, ITS>> — delegates to entityManager.query with fully typed options/results.

2) Page keys and helpers
- Accept and propagate page keys typed by index:
  - PKBI<CC, EM, ET, IT> and PKMBIS<CC, EM, ET, ITS> from entity-manager.
- Ensure any helper composing/using page keys respects the typed signatures (no casts).

3) Convenience methods (typed overloads)
- getItems<CC, EM, ET>(keys: Array<Record<HKT<CC> | RKT<CC>, string>>): Promise<ERBT<CC, EM, ET>[]>
  - Provide typed overloads keyed by ET (keep a broad fallback for dynamic cases).
- putItems/putRecords/read paths — align visible types with EIBT/ERBT where appropriate (non-breaking at runtime).

4) Runtime behavior
- No changes. These are type‑surface improvements only.

Dependencies and sequence
- Wait for entity-tools to publish defineTranscodes and strict acronyms in utility types.
- Wait for entity-manager to publish createEntityManager and token/index‑aware generics (PKBI, PKMBIS, SQFBI, QO, QR) and strict acronyms across all public APIs.
- Then update entity-client-dynamodb to import and mirror these types (do not fork or rename acronyms).

Acceptance criteria (provisional)
- QueryBuilder generic parameters renamed and ordered per acronyms above: <CC, EM, ET, ITS>.
- QueryBuilder.build returns Partial<Record<ITS, SQFBI<CC, EM, ET, ITS>>>.
- QueryBuilder.query accepts QO<CC, EM, ET, ITS> and returns QR<CC, EM, ET, ITS>.
- getItems has typed overloads by ET returning ERBT<CC, EM, ET>[] (retain a broad fallback).
- All @template tags and generated d.ts use the strict acronyms consistently.
- No runtime logic change; unit tests remain valid.

Notes
- Keep type computations shallow (mapped types over index tokens; simple Extract/Exclude patterns) to preserve editor performance.
- Avoid mixed‑case template names and any acronyms outside this dictionary.
- This note will be revised to include any additional types introduced by the finalized entity-manager refactor.
