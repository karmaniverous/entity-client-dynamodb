import {
  type Config,
  EntityManager,
  type EntityMap,
} from '@karmaniverous/entity-manager';
import type { Entity } from '@karmaniverous/entity-tools';
import { expect } from 'chai';
import { inspect } from 'util';

import { generateTableDefinition } from './generateTableDefinition';

interface Email extends Entity {
  created: number;
  email: string;
  userHashKey: never; // generated
  userId: string;
}

interface User extends Entity {
  beneficiaryId: string;
  created: number;
  firstName: string;
  firstNameCanonical: string;
  firstNameRangeKey: never; // generated
  lastName: string;
  lastNameCanonical: string;
  lastNameRangeKey: never; // generated
  phone?: string;
  updated: number;
  userBeneficiaryHashKey: never; // generated
  userHashKey: never; // generated
  userId: string;
}

interface MyEntityMap extends EntityMap {
  email: Email;
  user: User;
}

const now = Date.now();

const config: Config<MyEntityMap> = {
  hashKey: 'hashKey',
  rangeKey: 'rangeKey',
  entities: {
    email: {
      uniqueProperty: 'email',
      timestampProperty: 'created',
      shardBumps: [{ timestamp: now, charBits: 2, chars: 1 }],
      generated: {
        userHashKey: {
          atomic: true,
          elements: ['userId'],
          sharded: true,
        },
      },
      indexes: {
        created: { hashKey: 'hashKey', rangeKey: 'created' },
        userCreated: { hashKey: 'userHashKey', rangeKey: 'created' },
      },
      elementTranscodes: {
        created: 'timestamp',
        userId: 'string',
      },
    },
    user: {
      uniqueProperty: 'userId',
      timestampProperty: 'created',
      shardBumps: [{ timestamp: now, charBits: 2, chars: 1 }],
      generated: {
        firstNameRangeKey: {
          atomic: true,
          elements: ['firstNameCanonical', 'lastNameCanonical', 'created'],
        },
        lastNameRangeKey: {
          atomic: true,
          elements: ['lastNameCanonical', 'firstNameCanonical', 'created'],
        },
        userBeneficiaryHashKey: {
          atomic: true,
          elements: ['beneficiaryId'],
          sharded: true,
        },
        userHashKey: {
          atomic: true,
          elements: ['userId'],
          sharded: true,
        },
      },
      indexes: {
        created: { hashKey: 'hashKey', rangeKey: 'created' },
        firstName: { hashKey: 'hashKey', rangeKey: 'firstNameRangeKey' },
        lastName: { hashKey: 'hashKey', rangeKey: 'lastNameRangeKey' },
        phone: { hashKey: 'hashKey', rangeKey: 'phone' },
        updated: { hashKey: 'hashKey', rangeKey: 'updated' },
        userBeneficiaryCreated: {
          hashKey: 'userBeneficiaryHashKey',
          rangeKey: 'created',
          projections: ['someProperty', 'someOtherProperty'],
        },
        userBeneficiaryFirstName: {
          hashKey: 'userBeneficiaryHashKey',
          rangeKey: 'firstNameRangeKey',
        },
        userBeneficiaryLastName: {
          hashKey: 'userBeneficiaryHashKey',
          rangeKey: 'lastNameRangeKey',
        },
        userBeneficiaryPhone: {
          hashKey: 'userBeneficiaryHashKey',
          rangeKey: 'phone',
        },
        userBeneficiaryUpdated: {
          hashKey: 'userBeneficiaryHashKey',
          rangeKey: 'updated',
        },
      },
      elementTranscodes: {
        beneficiaryId: 'string',
        created: 'timestamp',
        firstNameCanonical: 'string',
        lastNameCanonical: 'string',
        phone: 'string',
        updated: 'timestamp',
        userId: 'string',
      },
    },
  },
};

// Configure & export EntityManager instance.
const entityManager = new EntityManager(config);

describe('generateTableDefinition', function () {
  it('should generate a table definition', function () {
    const tableDefinition = generateTableDefinition(entityManager);

    console.log(inspect(tableDefinition, false, null));

    expect(tableDefinition).to.deep.equal({
      AttributeDefinitions: [
        {
          AttributeName: 'hashKey',
          AttributeType: 'S',
        },
        {
          AttributeName: 'rangeKey',
          AttributeType: 'S',
        },
        {
          AttributeName: 'created',
          AttributeType: 'N',
        },
        {
          AttributeName: 'userHashKey',
          AttributeType: 'S',
        },
        {
          AttributeName: 'firstNameRangeKey',
          AttributeType: 'S',
        },
        {
          AttributeName: 'lastNameRangeKey',
          AttributeType: 'S',
        },
        {
          AttributeName: 'phone',
          AttributeType: 'S',
        },
        {
          AttributeName: 'updated',
          AttributeType: 'N',
        },
        {
          AttributeName: 'userBeneficiaryHashKey',
          AttributeType: 'S',
        },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'created',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'created', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'userCreated',
          KeySchema: [
            { AttributeName: 'userHashKey', KeyType: 'HASH' },
            { AttributeName: 'created', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'firstName',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'firstNameRangeKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'lastName',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'lastNameRangeKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'phone',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'phone', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'updated',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'updated', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'userBeneficiaryCreated',
          KeySchema: [
            { AttributeName: 'userBeneficiaryHashKey', KeyType: 'HASH' },
            { AttributeName: 'created', KeyType: 'RANGE' },
          ],
          Projection: {
            ProjectionType: 'INCLUDE',
            NonKeyAttributes: ['someProperty', 'someOtherProperty'],
          },
        },
        {
          IndexName: 'userBeneficiaryFirstName',
          KeySchema: [
            { AttributeName: 'userBeneficiaryHashKey', KeyType: 'HASH' },
            { AttributeName: 'firstNameRangeKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'userBeneficiaryLastName',
          KeySchema: [
            { AttributeName: 'userBeneficiaryHashKey', KeyType: 'HASH' },
            { AttributeName: 'lastNameRangeKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'userBeneficiaryPhone',
          KeySchema: [
            { AttributeName: 'userBeneficiaryHashKey', KeyType: 'HASH' },
            { AttributeName: 'phone', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'userBeneficiaryUpdated',
          KeySchema: [
            { AttributeName: 'userBeneficiaryHashKey', KeyType: 'HASH' },
            { AttributeName: 'updated', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      KeySchema: [
        {
          AttributeName: 'hashKey',
          KeyType: 'HASH',
        },
        {
          AttributeName: 'rangeKey',
          KeyType: 'RANGE',
        },
      ],
    });
  });
});
