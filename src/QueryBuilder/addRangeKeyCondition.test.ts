import { expect } from 'chai';

import { entityManager } from '../../test/entityManager';
import { EntityClient } from '../EntityClient';
import { QueryBuilder } from './QueryBuilder';

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

describe('QueryBuilder - addRangeKeyCondition', function () {
  beforeEach(function () {
    builder = new QueryBuilder({
      entityClient,
      entityToken: 'user',
      hashKeyToken: 'hashKey2',
    });
  });

  it('<', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: '<',
      value: 'value1',
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 < ${alias}`,
      },
    });
  });

  it('<=', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: '<=',
      value: 'value1',
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 <= ${alias}`,
      },
    });
  });

  it('=', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: '=',
      value: 'value1',
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 = ${alias}`,
      },
    });
  });

  it('>', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: '>',
      value: 'value1',
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 > ${alias}`,
      },
    });
  });

  it('>=', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: '>=',
      value: 'value1',
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 >= ${alias}`,
      },
    });
  });

  it('begins_with', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: 'begins_with',
      value: 'value1',
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `begins_with(#rangeKey1, ${alias})`,
      },
    });
  });

  it('between', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: 'between',
      value: { from: 'value1', to: 'value2' },
    });

    const [aliasFrom, aliasTo] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [aliasFrom]: 'value1',
          [aliasTo]: 'value2',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 BETWEEN ${aliasFrom} AND ${aliasTo}`,
      },
    });
  });

  it('between no bottom', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: 'between',
      value: { to: 'value2' },
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value2',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 <= ${alias}`,
      },
    });
  });

  it('between no top', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: 'between',
      value: { from: 'value1' },
    });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 >= ${alias}`,
      },
    });
  });

  it('between unbounded', function () {
    builder = builder.addRangeKeyCondition('index1', {
      property: 'rangeKey1',
      operator: 'between',
      value: {},
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
      .addRangeKeyCondition('index1', {
        property: 'rangeKey1',
        operator: 'between',
        value: {},
      })
      .addRangeKeyCondition('index1', {
        property: 'rangeKey1',
        operator: '<',
        value: 'value1',
      });

    const [alias] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias]: 'value1',
        },
        filterConditions: [],
        rangeKeyCondition: `#rangeKey1 < ${alias}`,
      },
    });
  });

  it('no actual replacement', function () {
    expect(
      () =>
        (builder = builder
          .addRangeKeyCondition('index1', {
            property: 'rangeKey1',
            operator: '<',
            value: 'value1',
          })
          .addRangeKeyCondition('index1', {
            property: 'rangeKey1',
            operator: '<',
            value: 'value1',
          })),
    ).to.throw('range key condition already exists');
  });
});
