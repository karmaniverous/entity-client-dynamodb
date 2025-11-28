---
title: Type Inference Mental Model
---

# Type Inference Mental Model

DX rules of thumb:

- Token in → narrowed type out
  - Pass a literal entity token (`'user' as const`) to get token-narrowed record types at call sites (no generics).
- Domain vs storage
  - Reads return storage records (keys included). Use `entityManager.removeKeys(entityToken, records)` in handlers when you want domain shapes.
- Projection K channel
  - When you pass projection tuples (const), item shapes narrow at the call site. The QueryBuilder preserves this through the adapter.
- Values-first config narrows index/page-key types
  - Build your EntityManager via `createEntityManager(config as const)`. The EntityClient carries the literal type,
    so `createQueryBuilder` infers index tokens (ITS) and per-index page keys automatically.
    Without a values-first literal, ITS defaults to `string`.

Patterns

```ts
// Token-aware get with projection tuple (const narrows the shape)
const out = await client.getItem('user', { hashKey2: 'h', rangeKey: 'r' }, [
  'a',
] as const);

// QueryBuilder narrows per-index page keys automatically when the client
// was constructed from createEntityManager(config as const)
const qb = createQueryBuilder({
  entityClient: client,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});
```

Related

- [Querying with QueryBuilder](./querying-with-querybuilder.md)
- [EntityClient: CRUD and batches](./entityclient-and-crud.md)
