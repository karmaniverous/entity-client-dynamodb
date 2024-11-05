import {
  type Config,
  EntityManager,
  type EntityMap,
  type ItemMap,
} from '@karmaniverous/entity-manager';
import type { Entity } from '@karmaniverous/entity-tools';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export interface User extends Entity {
  created: number;
  firstNameCanonical: string;
  firstNameRK?: never;
  lastNameCanonical: string;
  lastNameRK?: never;
  phone?: string;
  phoneRK?: never;
  updated: number;
  userId: string;
  userPK?: never;
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

const config: Config<MyEntityMap, 'hashKey2'> = {
  entities: {
    email: {
      elementTranscodes: {
        created: 'int',
        email: 'string',
        userId: 'string',
      },
      indexes: {
        userId: { hashKey: 'hashKey2', rangeKey: 'userId' },
      },
      timestampProperty: 'created',
      uniqueProperty: 'email',
    },
    user: {
      indexes: {
        created: { hashKey: 'hashKey2', rangeKey: 'created' },
        firstName: { hashKey: 'hashKey2', rangeKey: 'firstNameRK' },
        lastName: { hashKey: 'hashKey2', rangeKey: 'lastNameRK' },
        phone: { hashKey: 'hashKey2', rangeKey: 'phone' },
        updated: { hashKey: 'hashKey2', rangeKey: 'updated' },
      },
      generated: {
        firstNameRK: {
          elements: ['firstNameCanonical', 'lastNameCanonical'],
        },
        lastNameRK: {
          elements: ['lastNameCanonical', 'firstNameCanonical'],
        },
        phoneRK: {
          atomic: true,
          elements: ['phone', 'created'],
        },
        userPK: {
          elements: ['userId'],
          sharded: true,
        },
      },
      elementTranscodes: {
        created: 'int',
        firstNameCanonical: 'string',
        lastNameCanonical: 'string',
        phone: 'string',
        updated: 'int',
        userId: 'string',
      },
      shardBumps: [
        { timestamp: now + day, charBits: 2, chars: 1 },
        { timestamp: now + day * 2, charBits: 2, chars: 2 },
      ],
      timestampProperty: 'created',
      uniqueProperty: 'userId',
    },
  },
  hashKey: 'hashKey2',
  rangeKey: 'rangeKey',
};

export type UserItem = ItemMap<MyEntityMap, 'hashKey2'>['user'];

export const entityManager = new EntityManager(config);
