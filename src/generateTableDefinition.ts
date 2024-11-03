import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import { EntityManager, type EntityMap } from '@karmaniverous/entity-manager';
import type { TranscodeMap } from '@karmaniverous/entity-tools';

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
export const generateTableDefinition = <
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
>(
  entityManager: EntityManager<M, HashKey, RangeKey, T>,
  transcodeAtttributeTypeMap: TranscodeAttributeTypeMap<T> = defaultTranscodeAttributeTypeMap,
): Pick<
  CreateTableCommandInput,
  'AttributeDefinitions' | 'GlobalSecondaryIndexes' | 'KeySchema'
> => {
  const {
    config: { entities, hashKey, rangeKey },
  } = entityManager;

  // Attribute definitions always include hashKey & rangeKey.
  const attributeDefinitions: CreateTableCommandInput['AttributeDefinitions'] =
    [
      { AttributeName: hashKey, AttributeType: 'S' },
      { AttributeName: rangeKey, AttributeType: 'S' },
    ];

  const globalSecondaryIndexes: CreateTableCommandInput['GlobalSecondaryIndexes'] =
    [];

  // Iterate across every entity index.
  for (const entity of Object.values(entities))
    for (const [
      indexToken,
      { hashKey, rangeKey, projections },
    ] of Object.entries(entity.indexes)) {
      // If the index is already in the global secondary index definitions,
      // skip it.
      if (globalSecondaryIndexes.find((i) => i.IndexName === indexToken))
        continue;

      // Create the global secondary index.
      globalSecondaryIndexes.push({
        IndexName: indexToken,
        KeySchema: [
          { AttributeName: hashKey, KeyType: 'HASH' },
          { AttributeName: rangeKey, KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: projections ? 'INCLUDE' : 'ALL',
          ...(projections ? { NonKeyAttributes: projections } : {}),
        },
      });

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
            component in entity.generated
              ? 'S'
              : (transcodeAtttributeTypeMap[
                  entity.elementTranscodes[
                    component
                  ] as keyof TranscodeAttributeTypeMap<T>
                ] ?? 'S'),
        });
      }
    }

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
