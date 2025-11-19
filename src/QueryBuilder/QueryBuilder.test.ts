import { beforeEach, describe, expect, it } from 'vitest';

import { entityManager } from '../../test/entityManager';
import { EntityClient } from '../EntityClient';
import { QueryBuilder } from '../QueryBuilder';

const entityClient = new EntityClient({
  entityManager,
  region: process.env.AWS_DEFAULT_REGION,
  tableName: 'UserTable',
});

let builder = new QueryBuilder({
  entityClient,
  entityToken: 'user',
  hashKeyToken: 'hashKey2',
});

describe('QueryBuilder - constructor', function () {
  beforeEach(function () {
    builder = new QueryBuilder({
      entityClient,
      entityToken: 'user',
      hashKeyToken: 'hashKey2',
    });
  });

  it('should create a QueryBuilder instance', function () {
    expect(builder).to.be.an.instanceof(QueryBuilder);
  });

  describe('ergonomics', function () {
    it('setScanIndexForward should set scan direction and ensure params entry', function () {
      builder = builder.setScanIndexForward('index1' as never, false);
      expect(builder.indexParamsMap).to.deep.equal({
        index1: {
          expressionAttributeNames: {},
          expressionAttributeValues: {},
          filterConditions: [],
          scanIndexForward: false,
        },
      });
    });

    it('setProjectionAll should apply uniform projections across indices', function () {
      builder = builder.setProjectionAll(
        ['index1', 'index2'] as never[],
        ['a', 'b'] as const,
      );
      expect(builder.indexParamsMap).to.deep.equal({
        index1: {
          expressionAttributeNames: {},
          expressionAttributeValues: {},
          filterConditions: [],
          projectionAttributes: ['a', 'b'],
        },
        index2: {
          expressionAttributeNames: {},
          expressionAttributeValues: {},
          filterConditions: [],
          projectionAttributes: ['a', 'b'],
        },
      });
    });

    it('resetProjection should clear projection for a single index', function () {
      builder = builder
        .setProjection('index1' as never, ['x'] as const)
        .resetProjection('index1' as never);
      expect(builder.indexParamsMap.index1.projectionAttributes).to.be
        .undefined;
    });

    it('resetAllProjections should clear projections for all indices', function () {
      builder = builder
        .setProjection('index1' as never, ['x'] as const)
        .setProjection('index2' as never, ['y'] as const);
      builder = builder.resetAllProjections();
      expect(builder.indexParamsMap).to.deep.equal({
        index1: {
          expressionAttributeNames: {},
          expressionAttributeValues: {},
          filterConditions: [],
        },
        index2: {
          expressionAttributeNames: {},
          expressionAttributeValues: {},
          filterConditions: [],
        },
      });
    });
  });
});
