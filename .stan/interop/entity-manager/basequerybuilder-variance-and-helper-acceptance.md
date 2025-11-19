# Interop — BaseQueryBuilder variance and helper acceptance (typing-only request)

Context
- Downstream adapters (e.g., @karmaniverous/entity-client-dynamodb) extend BaseQueryBuilder with additional generics (CF, K) and provide adapter-specific IndexParams. We call upstream helpers such as addFilterCondition/addRangeKeyCondition that currently require a concrete builder parameter type.
- In the adapter, those calls can fail assignability under TypeScript variance even though the helpers only rely on a small structural subset (indexParamsMap, entityClient.logger) and not on the full concrete type.

Problem
- We need to bridge variance with `unknown as` casts at helper call sites, which weakens type-safety and clutters code:
  ```ts
  addRangeKeyCondition(this as unknown as QueryBuilder<C>, indexToken, ...);
  addFilterCondition(this as unknown as QueryBuilder<C>, indexToken, ...);
  ```
- These casts exist solely to satisfy the helper parameter type, not because of a genuine runtime difference.

Proposal (typing-only; no runtime change)

Option A — Structural acceptance
- Change helper parameter types to accept a minimal structural shape:
  ```ts
  type LoggerLike = Pick<Console, 'debug' | 'error'>;
  type MinimalBuilder = {
    indexParamsMap: Record<string, unknown>;
    entityClient: { logger: LoggerLike };
  };
  export function addFilterCondition<B extends MinimalBuilder>(builder: B, indexToken: string, condition: ...): void { ... }
  export function addRangeKeyCondition<B extends MinimalBuilder>(builder: B, indexToken: string, condition: ...): void { ... }
  ```
- Helpers continue to operate exactly as before and rely only on the minimal shape they actually use.

Option B — Generic BaseQueryBuilder acceptance
- Loosen the helper parameter type to accept any BaseQueryBuilder instance regardless of its specific generics (ET/ITS/CF/K):
  ```ts
  export function addFilterCondition<
    CC extends BaseConfigMap,
    Client extends BaseEntityClient<CC>,
    IP,
    ET extends EntityToken<CC>,
    ITS extends string,
    CF = unknown,
    K = unknown,
    B extends BaseQueryBuilder<CC, Client, IP, ET, ITS, CF, K>
  >(builder: B, indexToken: ITS, condition: ...): void { ... }
  ```
- This keeps the direct relationship with BaseQueryBuilder while avoiding overly tight generic constraints that break downstream variance.

Rationale
- Both options reflect the real usage inside the helpers (indexParamsMap and logger), and neither option affects runtime semantics.
- Either approach eliminates the need for downstream “unknown as …” casts and keeps call sites type‑safe and readable.

Backward compatibility
- Existing downstream code remains assignable under both options.
- No user-visible API changes; this is purely a types improvement.

Acceptance criteria
- Helpers compile clean with the relaxed parameter typing.
- Downstream adapters can remove variance-bridging casts at the call sites.
- No changes to helper runtime behavior (verified by existing test suites).

Follow-up downstream (in entity-client-dynamodb)
- Remove variance casts around addFilterCondition/addRangeKeyCondition.
- Keep QueryBuilder generics (CF, K) and the per-index IndexParams unchanged.

Notes
- If Option A is preferred, document the minimal structural contract to prevent accidental reliance on other members.
- If Option B is preferred, consider adding a comment explaining that the wider BaseQueryBuilder acceptance is intentional to support adapter extensions (CF/K).
