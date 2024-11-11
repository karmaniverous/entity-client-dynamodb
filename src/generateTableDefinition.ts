import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ScalarAttributeType } from '@aws-sdk/client-dynamodb';
import { BaseConfigMap, EntityManager } from '@karmaniverous/entity-manager';

import {
  defaultTranscodeAttributeTypeMap,
  TranscodeAttributeTypeMap,
} from './TranscodeAttributeTypeMap';

/**
 * Generates a partial DynamoDB {@link CreateTableCommandInput | `CreateTableCommandInput`} object for a given EntityManager. Properties generated:
 * - `AttributeDefinitions`
 * - `GlobalSecondaryIndexes`
 * - `KeySchema`
 *
 * @param entityManager - {@link EntityManager | `EntityManager`} instance.
 * @param transcodeAtttributeTypeMap - {@link TranscodeAttributeTypeMap | `TranscodeAttributeTypeMap`} object linking non-string transcodes to a DynamoDB {@link ScalarAttributeType | `ScalarAttributeType`}. Defaults to {@link defaultTranscodeAttributeTypeMap | `defaultTranscodeAttributeTypeMap`}.
 *
 * @returns Partial DynamoDB CreateTableCommandInput object.
 *
 * @example
 * ```ts
 * const entityManager = new EntityManager(config);
 * const entityClient = new EntityClient({region: 'us-east-1});
 * const tableDefinition = generateTableDefinition(entityManager);
 *
 * await entityClient.createTable({...tableDefinition, TableName: 'user'});
 * ```
 *
 * @category Tables
 */
export const generateTableDefinition = <C extends BaseConfigMap>(
  entityManager: EntityManager<C>,
  transcodeAtttributeTypeMap: TranscodeAttributeTypeMap<
    C['TranscodeMap']
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
          // are not included in the transcodeAtttributeTypeMap are assumed to
          // be strings.
          attributeDefinitions.push({
            AttributeName: component,
            AttributeType:
              component in sharded || component in unsharded
                ? 'S'
                : (transcodeAtttributeTypeMap[
                    propertyTranscodes[
                      component
                    ] as keyof TranscodeAttributeTypeMap<C['TranscodeMap']>
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
            ProjectionType: projections ? 'INCLUDE' : 'ALL',
            ...(projections ? { NonKeyAttributes: projections } : {}),
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
