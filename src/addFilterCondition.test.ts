import { expect } from 'chai';

import { EntityClient } from './EntityClient';
import { ShardQueryMapBuilder } from './ShardQueryMapBuilder';

const entityManagerClient = new EntityClient({
  region: process.env.AWS_DEFAULT_REGION,
});

let builder: ShardQueryMapBuilder<{ hashKey2: string }>;

describe('ShardQueryMapBuilder - addFilterCondition', function () {
  beforeEach(function () {
    builder = new ShardQueryMapBuilder({
      doc: entityManagerClient.doc,
      hashKeyToken: 'hashKey2',
      tableName: 'UserTable',
    });
  });

  it('<', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 < ${alias}`],
      },
    });
  });

  it('<=', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 <= ${alias}`],
      },
    });
  });

  it('=', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 = ${alias}`],
      },
    });
  });

  it('>', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 > ${alias}`],
      },
    });
  });

  it('>=', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 >= ${alias}`],
      },
    });
  });

  it('begins_with', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`begins_with(#rangeKey1, ${alias})`],
      },
    });
  });

  it('between', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 BETWEEN ${aliasFrom} AND ${aliasTo}`],
      },
    });
  });

  it('between no bottom', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 <= ${alias}`],
      },
    });
  });

  it('between no top', function () {
    builder = builder.addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 >= ${alias}`],
      },
    });
  });

  it('between unbounded', function () {
    builder = builder.addFilterCondition('index1', {
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
      .addFilterCondition('index1', {
        property: 'rangeKey1',
        operator: 'between',
        value: {},
      })
      .addFilterCondition('index1', {
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
        filterConditions: [`#rangeKey1 < ${alias}`],
      },
    });
  });

  it('contains', function () {
    builder = builder.addFilterCondition('index1', {
      property: 'rangeKey1',
      operator: 'contains',
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
        filterConditions: [`contains(#rangeKey1, ${alias})`],
      },
    });
  });

  it('attribute_exists', function () {
    builder = builder.addFilterCondition('index1', {
      property: 'rangeKey1',
      operator: 'attribute_exists',
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {},
        filterConditions: [`attribute_exists(#rangeKey1)`],
      },
    });
  });

  it('attribute_not_exists', function () {
    builder = builder.addFilterCondition('index1', {
      property: 'rangeKey1',
      operator: 'attribute_not_exists',
    });

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {},
        filterConditions: [`attribute_not_exists(#rangeKey1)`],
      },
    });
  });

  it('in', function () {
    builder = builder.addFilterCondition('index1', {
      property: 'rangeKey1',
      operator: 'in',
      value: ['value1', 'value2', 'value3'],
    });

    const [alias1, alias2, alias3] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias1]: 'value1',
          [alias2]: 'value2',
          [alias3]: 'value3',
        },
        filterConditions: [`#rangeKey1 IN (${alias1}, ${alias2}, ${alias3})`],
      },
    });
  });

  it('group', function () {
    builder = builder.addFilterCondition('index1', {
      operator: 'and',
      conditions: [
        {
          property: 'rangeKey1',
          operator: '<',
          value: 'value1',
        },
        {
          property: 'rangeKey1',
          operator: '>',
          value: 'value2',
        },
      ],
    });

    const [alias1, alias2] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias1]: 'value1',
          [alias2]: 'value2',
        },
        filterConditions: [
          `(#rangeKey1 < ${alias1}) AND (#rangeKey1 > ${alias2})`,
        ],
      },
    });
  });

  it('not', function () {
    builder = builder.addFilterCondition('index1', {
      operator: 'not',
      condition: {
        operator: 'or',
        conditions: [
          {
            property: 'rangeKey1',
            operator: '<',
            value: 'value1',
          },
          {
            property: 'rangeKey1',
            operator: '>',
            value: 'value2',
          },
        ],
      },
    });

    const [alias1, alias2] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias1]: 'value1',
          [alias2]: 'value2',
        },
        filterConditions: [
          `NOT ((#rangeKey1 < ${alias1}) OR (#rangeKey1 > ${alias2}))`,
        ],
      },
    });
  });

  it('second filter condition', function () {
    builder = builder
      .addFilterCondition('index1', {
        property: 'rangeKey1',
        operator: '<',
        value: 'value1',
      })
      .addFilterCondition('index1', {
        property: 'rangeKey1',
        operator: '>',
        value: 'value2',
      });

    const [alias1, alias2] = Object.keys(
      builder.indexParamsMap.index1.expressionAttributeValues,
    );

    expect(builder.indexParamsMap).to.deep.equal({
      index1: {
        expressionAttributeNames: {
          '#rangeKey1': 'rangeKey1',
        },
        expressionAttributeValues: {
          [alias1]: 'value1',
          [alias2]: 'value2',
        },
        filterConditions: [`#rangeKey1 < ${alias1}`, `#rangeKey1 > ${alias2}`],
      },
    });
  });
});
