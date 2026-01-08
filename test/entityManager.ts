import {
  type Config,
  type ConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';
import {
  defaultTranscodes,
  type Entity,
  type EntityMap,
} from '@karmaniverous/entity-tools';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export interface User extends Entity {
  created: number;
  firstNameCanonical: string;
  lastNameCanonical: string;
  phone?: string;
  updated: number;
  userId: string;
}

export interface Email extends Entity {
  created: number;
  email: string;
  userId: string;
}

export interface MyEntityMap extends EntityMap {
  user: User;
  email: Email;
}

export type MyConfigMap = ConfigMap<{
  EntityMap: MyEntityMap;
  HashKey: 'hashKey2';
  ShardedKeys: 'userPK';
  UnshardedKeys: 'firstNameRK' | 'lastNameRK' | 'phoneRK';
  TranscodedProperties:
    | 'created'
    | 'email'
    | 'firstNameCanonical'
    | 'lastNameCanonical'
    | 'phone'
    | 'updated'
    | 'userId';
}>;

const config: Config<MyConfigMap> = {
  entities: {
    email: {
      timestampProperty: 'created',
      uniqueProperty: 'email',
    },
    user: {
      shardBumps: [
        { timestamp: now + day, charBits: 2, chars: 1 },
        { timestamp: now + day * 2, charBits: 2, chars: 2 },
      ],
      timestampProperty: 'created',
      uniqueProperty: 'userId',
    },
  },
  generatedProperties: {
    sharded: { userPK: ['userId'] },
    unsharded: {
      firstNameRK: ['firstNameCanonical', 'lastNameCanonical'],
      lastNameRK: ['lastNameCanonical', 'firstNameCanonical'],
      phoneRK: ['phone', 'created'],
    },
  },
  indexes: {
    created: { hashKey: 'hashKey2', rangeKey: 'created' },
    firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
    lastName: { hashKey: 'hashKey2', rangeKey: 'lastNameRK' },
    phone: { hashKey: 'hashKey2', rangeKey: 'phone' },
    updated: { hashKey: 'hashKey2', rangeKey: 'updated' },
    userId: { hashKey: 'hashKey2', rangeKey: 'userId' },
  },
  hashKey: 'hashKey2',
  propertyTranscodes: {
    created: 'int',
    email: 'string',
    firstNameCanonical: 'string',
    lastNameCanonical: 'string',
    phone: 'string',
    updated: 'int',
    userId: 'string',
  },
  rangeKey: 'rangeKey',
  transcodes: defaultTranscodes,
};

export const entityManager = new EntityManager(config);
