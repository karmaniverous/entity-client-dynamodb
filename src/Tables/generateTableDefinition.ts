import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ScalarAttributeType } from '@aws-sdk/client-dynamodb'; // imported to support API docs
import {
  type BaseConfigMap,
  type EntityManager,
} from '@karmaniverous/entity-manager';

import {
  defaultTranscodeAttributeTypeMap,
  type TranscodeAttributeTypeMap,
} from './TranscodeAttributeTypeMap';

/**
 * Generates a partial DynamoDB {@link CreateTableCommandInput | `CreateTableCommandInput`} object for a given EntityManager. Properties generated:
 * - `AttributeDefinitions`
 * - `GlobalSecondaryIndexes`
 * - `KeySchema`
 *
 * @typeParam C - Entity-manager config map.
 *
 * @param entityManager - {@link EntityManager | `EntityManager`} instance.
 * @param transcodeAttributeTypeMap - {@link TranscodeAttributeTypeMap | `TranscodeAttributeTypeMap`} object linking non-string transcodes to a DynamoDB {@link ScalarAttributeType | `ScalarAttributeType`}. Defaults to {@link defaultTranscodeAttributeTypeMap | `defaultTranscodeAttributeTypeMap`}.
 *
 * @returns Partial DynamoDB CreateTableCommandInput object.
 *
 * @example
 * ```ts
 * const entityManager = new EntityManager(config);
 * const entityClient = new EntityClient({
 *   entityManager,
 *   tableName: 'UserTable',
 *   region: 'us-east-1',
 * });
 *
 * const tableDefinition = generateTableDefinition(entityManager);
 * await entityClient.createTable({
 *   BillingMode: 'PAY_PER_REQUEST',
 *   ...tableDefinition,
 * });
 * ```
 *
 * @category Tables
 */
export const generateTableDefinition = <C extends BaseConfigMap>(
  entityManager: EntityManager<C>,
  transcodeAttributeTypeMap: TranscodeAttributeTypeMap<
    C['TranscodeRegistry']
  > = defaultTranscodeAttributeTypeMap,
): Pick<
  CreateTableCommandInput,
  'AttributeDefinitions' | 'GlobalSecondaryIndexes' | 'KeySchema'
> => {
  const {
    config: {
      generatedProperties: { sharded, unsharded },
      hashKey,
      indexes,
      rangeKey,
      propertyTranscodes,
    },
  } = entityManager;

  // Attribute definitions always include hashKey & rangeKey.
  const attributeDefinitions: CreateTableCommandInput['AttributeDefinitions'] =
    [
      { AttributeName: hashKey, AttributeType: 'S' },
      { AttributeName: rangeKey, AttributeType: 'S' },
    ];

  // Create global secondary indexes.
  const globalSecondaryIndexes: CreateTableCommandInput['GlobalSecondaryIndexes'] =
    Object.entries(indexes).map(
      ([indexToken, { hashKey, rangeKey, projections }]) => {
        // Iterate across every index component.
        for (const component of [hashKey, rangeKey]) {
          // If the component is already in the attribute definitions, skip it.
          if (attributeDefinitions.find((a) => a.AttributeName === component))
            continue;

          // All generated properties are strings. Properties whose transcodes
          // are not included in the transcodeAttributeTypeMap are assumed to
          // be strings.
          attributeDefinitions.push({
            AttributeName: component,
            AttributeType:
              component in sharded || component in unsharded
                ? 'S'
                : (transcodeAttributeTypeMap[
                    propertyTranscodes[
                      component
                    ] as keyof TranscodeAttributeTypeMap<C['TranscodeRegistry']>
                  ] ?? 'S'),
          });
        }

        // Return the global secondary index object.
        return {
          IndexName: indexToken,
          KeySchema: [
            { AttributeName: hashKey, KeyType: 'HASH' },
            { AttributeName: rangeKey, KeyType: 'RANGE' },
          ],
          Projection: {
            ProjectionType: projections
              ? projections.length
                ? 'INCLUDE'
                : 'KEYS_ONLY'
              : 'ALL',
            ...(projections?.length ? { NonKeyAttributes: projections } : {}),
          },
        };
      },
    );

  return {
    AttributeDefinitions: attributeDefinitions,
    ...(globalSecondaryIndexes.length
      ? { GlobalSecondaryIndexes: globalSecondaryIndexes }
      : {}),
    KeySchema: [
      { AttributeName: hashKey, KeyType: 'HASH' },
      { AttributeName: rangeKey, KeyType: 'RANGE' },
    ],
  };
};
