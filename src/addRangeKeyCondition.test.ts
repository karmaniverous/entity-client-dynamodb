import { expect } from 'chai';

import { EntityManagerClient } from './EntityManagerClient';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

const entityManagerClient = new EntityManagerClient({
  region: process.env.AWS_DEFAULT_REGION,
});

let builder: ShardQueryMapBuilder;

describe('ShardQueryMapBuilder - addRangeKeyCondition', function () {
  beforeEach(function () {
    builder = new ShardQueryMapBuilder({
      dynamoDBDocument: entityManagerClient.doc,
      entityToken: 'user',
      hashKeyToken: 'hashKey2',
      tableName: 'UserTable',
    });
  });

  it('<', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: '<',
      item: { rangeKey1: 'value1' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 < :rangeKey1',
      },
    });
  });

  it('<=', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: '<=',
      item: { rangeKey1: 'value1' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 <= :rangeKey1',
      },
    });
  });

  it('=', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: '=',
      item: { rangeKey1: 'value1' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 = :rangeKey1',
      },
    });
  });

  it('>', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: '>',
      item: { rangeKey1: 'value1' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 > :rangeKey1',
      },
    });
  });

  it('>=', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: '>=',
      item: { rangeKey1: 'value1' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 >= :rangeKey1',
      },
    });
  });

  it('begins_with', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: 'begins_with',
      item: { rangeKey1: 'value1' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: 'begins_with(#rangeKey1, :rangeKey1)',
      },
    });
  });

  it('between', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: 'between',
      item: { rangeKey1: 'value1' },
      toItem: { rangeKey1: 'value2' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1From': 'value1',
          ':rangeKey1To': 'value2',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 BETWEEN :rangeKey1From AND :rangeKey1To',
      },
    });
  });

  it('between no bottom', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: 'between',
      item: {},
      toItem: { rangeKey1: 'value2' },
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1To': 'value2',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 <= :rangeKey1To',
      },
    });
  });

  it('between no top', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: 'between',
      item: { rangeKey1: 'value1' },
      toItem: {},
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1From': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 >= :rangeKey1From',
      },
    });
  });

  it('between unbounded', function () {
    builder = builder.addRangeKeyCondition({
      indexToken: 'index1',
      rangeKeyToken: 'rangeKey1',
      operator: 'between',
      item: {},
      toItem: {},
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {},
        expressionAttributeValues: {},
        filterConditions: [],
      },
    });
  });

  it('between unbounded replacement', function () {
    builder = builder
      .addRangeKeyCondition({
        indexToken: 'index1',
        rangeKeyToken: 'rangeKey1',
        operator: 'between',
        item: {},
        toItem: {},
      })
      .addRangeKeyCondition({
        indexToken: 'index1',
        rangeKeyToken: 'rangeKey1',
        operator: '<',
        item: { rangeKey1: 'value1' },
      });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          ':rangeKey1': 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: '#rangeKey1 < :rangeKey1',
      },
    });
  });

  it('no actual replacement', function () {
    expect(
      () =>
        (builder = builder
          .addRangeKeyCondition({
            indexToken: 'index1',
            rangeKeyToken: 'rangeKey1',
            operator: '<',
            item: { rangeKey1: 'value1' },
          })
          .addRangeKeyCondition({
            indexToken: 'index1',
            rangeKeyToken: 'rangeKey1',
            operator: '<',
            item: { rangeKey1: 'value1' },
          })),
    ).to.throw('range key condition already exists');
  });
});
