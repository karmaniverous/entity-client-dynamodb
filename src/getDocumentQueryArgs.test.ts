import { expect } from 'chai';

import {
  getDocumentQueryArgs,
  type GetDynamoDbDocumentQueryArgsParams,
} from './getDocumentQueryArgs';

let defaultArgs: GetDynamoDbDocumentQueryArgsParams;

describe('getDocumentQueryArgs', function () {
  beforeEach(function () {
    defaultArgs = {
      hashKey: 'hashKey',
      hashKeyToken: 'hashKeyToken',
      indexParamsMap: {
        index1: {
          expressionAttributeNames: {
            '#propertyToken': 'propertyToken',
            '#rangeKeyToken': 'rangeKeyToken',
          },
          expressionAttributeValues: {
            ':propertyValue1': 'propertyValue1',
            ':propertyValue2': 'propertyValue2',
            ':rangeKeyValue': 'rangeKeyValue',
          },
          filterConditions: [
            '#propertyToken > :propertyValue1',
            '#propertyToken < :propertyValue2',
          ],
          rangeKeyCondition: '#rangeKeyToken = :rangeKeyValue',
          scanIndexForward: true,
        },
      },
      indexToken: 'index1',
      tableName: 'tableName',
      pageKey: { hashKeyToken: 'hashKey', rangeKeyToken: 'rangeKeyValue' },
      pageSize: 10,
    };
  });

  it('should return the expected object', function () {
    const result = getDocumentQueryArgs(defaultArgs);

    expect(result).to.deep.equal({
      ExclusiveStartKey: {
        hashKeyToken: 'hashKey',
        rangeKeyToken: 'rangeKeyValue',
      },
      ExpressionAttributeNames: {
        '#hashKeyToken': 'hashKeyToken',
        '#propertyToken': 'propertyToken',
        '#rangeKeyToken': 'rangeKeyToken',
      },
      ExpressionAttributeValues: {
        ':hashKey': 'hashKey',
        ':propertyValue1': 'propertyValue1',
        ':propertyValue2': 'propertyValue2',
        ':rangeKeyValue': 'rangeKeyValue',
      },
      FilterExpression:
        '(#propertyToken > :propertyValue1) AND (#propertyToken < :propertyValue2)',
      IndexName: 'index1',
      KeyConditionExpression:
        '#hashKeyToken = :hashKey AND #rangeKeyToken = :rangeKeyValue',
      Limit: 10,
      ScanIndexForward: true,
      TableName: 'tableName',
    });
  });

  it('should handle empty properties', function () {
    defaultArgs.indexParamsMap.index1.expressionAttributeNames = {};
    defaultArgs.indexParamsMap.index1.expressionAttributeValues = {};
    defaultArgs.indexParamsMap.index1.filterConditions = [];
    delete defaultArgs.indexParamsMap.index1.rangeKeyCondition;
    delete defaultArgs.indexParamsMap.index1.scanIndexForward;
    delete defaultArgs.pageKey;
    delete defaultArgs.pageSize;

    const result = getDocumentQueryArgs(defaultArgs);

    expect(result).to.deep.equal({
      ExpressionAttributeNames: {
        '#hashKeyToken': 'hashKeyToken',
      },
      ExpressionAttributeValues: {
        ':hashKey': 'hashKey',
      },
      IndexName: 'index1',
      KeyConditionExpression: '#hashKeyToken = :hashKey',
      TableName: 'tableName',
    });
  });
});
