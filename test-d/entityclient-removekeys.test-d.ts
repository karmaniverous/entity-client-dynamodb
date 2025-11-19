import type {
  EntityClient,
  EntityItemByToken,
  EntityRecordByToken,
} from '@karmaniverous/entity-client-dynamodb';
import type { EntityKey, BaseConfigMap } from '@karmaniverous/entity-manager';
import type { MyConfigMap } from '../test/entityManager';
import { expectAssignable, expectType } from 'tsd';

declare const client: EntityClient<MyConfigMap>;
declare const key: EntityKey<MyConfigMap>;
declare const keys: EntityKey<MyConfigMap>[];

// Helpers to extract shapes from Promises
type Awaited<T> = T extends Promise<infer U> ? U : T;
type ItemsOf<P> = P extends Promise<{ items: infer I }> ? I : never;
type ItemOf<P> =
  P extends Promise<infer R>
    ? R extends { Item?: infer I }
      ? I
      : never
    : never;

// getItems — removeKeys: true → EntityItemByToken[]
const giTrue = client.getItems('user', keys, { removeKeys: true });
type GITrueItems = ItemsOf<typeof giTrue>;
expectType<EntityItemByToken<MyConfigMap, 'user'>[]>(
  null as unknown as GITrueItems,
);

// getItems — removeKeys: false → EntityRecordByToken[]
const giFalse = client.getItems('user', keys, { removeKeys: false });
type GIFalseItems = ItemsOf<typeof giFalse>;
expectType<EntityRecordByToken<MyConfigMap, 'user'>[]>(
  null as unknown as GIFalseItems,
);

// getItems — tuple projection + removeKeys: true
const giProjTrue = client.getItems('user', keys, ['created'] as const, {
  removeKeys: true,
});
type GIProjTrueItems = ItemsOf<typeof giProjTrue>;
expectType<Pick<EntityItemByToken<MyConfigMap, 'user'>, 'created'>[]>(
  null as unknown as GIProjTrueItems,
);

// getItems — tuple projection + removeKeys: false
const giProjFalse = client.getItems('user', keys, ['created'] as const, {
  removeKeys: false,
});
type GIProjFalseItems = ItemsOf<typeof giProjFalse>;
expectType<Pick<EntityRecordByToken<MyConfigMap, 'user'>, 'created'>[]>(
  null as unknown as GIProjFalseItems,
);

// getItem — removeKeys: true → EntityItemByToken | undefined
const oneTrue = client.getItem('user', key, { removeKeys: true });
type OneTrueItem = ItemOf<typeof oneTrue>;
expectAssignable<EntityItemByToken<MyConfigMap, 'user'> | undefined>(
  null as unknown as OneTrueItem,
);

// getItem — removeKeys: false → EntityRecordByToken | undefined
const oneFalse = client.getItem('user', key, { removeKeys: false });
type OneFalseItem = ItemOf<typeof oneFalse>;
expectAssignable<EntityRecordByToken<MyConfigMap, 'user'> | undefined>(
  null as unknown as OneFalseItem,
);

// getItem — tuple projection + removeKeys: true
const oneProjTrue = client.getItem('user', key, ['created'] as const, {
  removeKeys: true,
});
type OneProjTrue = ItemOf<typeof oneProjTrue>;
expectAssignable<Pick<EntityItemByToken<MyConfigMap, 'user'>, 'created'> | undefined>(
  null as unknown as OneProjTrue,
);

// Non-literal boolean flag → union persists
declare const flag: boolean;

// getItems — removeKeys: boolean → union of Item/Record arrays
const giFlag = client.getItems('user', keys, { removeKeys: flag });
type GIFlagItems = ItemsOf<typeof giFlag>;
expectType<
  | EntityRecordByToken<MyConfigMap, 'user'>[]
  | EntityItemByToken<MyConfigMap, 'user'>[]
>(null as unknown as GIFlagItems);

// getItem — removeKeys: boolean → union of Item/Record (plus undefined)
const oneFlag = client.getItem('user', key, { removeKeys: flag });
type OneFlagItem = ItemOf<typeof oneFlag>;
expectAssignable<
  | EntityRecordByToken<MyConfigMap, 'user'>
  | EntityItemByToken<MyConfigMap, 'user'>
  | undefined
>(null as unknown as OneFlagItem);