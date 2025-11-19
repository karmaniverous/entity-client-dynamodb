import { createQueryBuilder } from '@karmaniverous/entity-client-dynamodb';
import type {
  EntityItemByToken,
  EntityClient,
} from '@karmaniverous/entity-client-dynamodb';
import type { MyConfigMap } from '../test/entityManager';
import { expectType } from 'tsd';

// Minimal, types-only builder for MyConfigMap/'user'.
declare const entityClient: EntityClient<MyConfigMap>;
const qb0 = createQueryBuilder({
  entityClient,
  entityToken: 'user' as const,
  hashKeyToken: 'hashKey2' as const,
});

// Helper type to extract items from the builder's query return type.
type QueryItemsOf<B> = B extends {
  query: (...args: any[]) => Promise<{ items: infer I }>;
}
  ? I
  : never;

// Narrow K via setProjection (single index)
const qb1 = qb0.setProjection('created', ['created'] as const);
type Items1 = QueryItemsOf<typeof qb1>;
expectType<Array<Pick<EntityItemByToken<MyConfigMap, 'user'>, 'created'>>>(
  null as unknown as Items1,
);

// Widen K back to unknown via resetProjection (single index)
const qb2 = qb1.resetProjection('created');
type Items2 = QueryItemsOf<typeof qb2>;
expectType<Array<EntityItemByToken<MyConfigMap, 'user'>>>(
  null as unknown as Items2,
);

// Uniform projection across indices narrows K to the provided tuple
const qb3 = qb0.setProjectionAll(
  ['created'] as const,
  ['created', 'updated'] as const,
);
type Items3 = QueryItemsOf<typeof qb3>;
expectType<
  Array<Pick<EntityItemByToken<MyConfigMap, 'user'>, 'created' | 'updated'>>
>(null as unknown as Items3);
