import { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  BaseConfigMap,
  BaseEntityClientOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type EntityManager, // imported to support API docs
} from '@karmaniverous/entity-manager';

/**
 * DynamoDB EntityClient options. Extends {@link BaseEntityClientOptions | `BaseEntityClientOptions`} and {@link DynamoDBClientConfig | `DynamoDBClientConfig`} with the following additional properties:
 * - `[enableXray]` - Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment.
 * - `entityManager` - {@link EntityManager | `EntityManager`} instance.
 * - `tableName` - Table name.
 *
 * @category EntityClient
 */
export interface EntityClientOptions<C extends BaseConfigMap, CF = unknown>
  extends BaseEntityClientOptions<C, CF>, Omit<DynamoDBClientConfig, 'logger'> {
  /** Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment. */
  enableXray?: boolean | undefined;

  /** Table name. */
  tableName: string;
}
