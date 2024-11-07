import { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { BaseEntityClientOptions } from '@karmaniverous/entity-manager';

/**
 * DynamoDB EntityClient options. Extends {@link BaseEntityClientOptions | `BaseEntityClientOptions`} and {@link DynamoDBClientConfig | `DynamoDBClientConfig`} with the following additional properties:
 * - `enableXray` - Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment.
 *
 * @category EntityClient
 */
export interface EntityClientOptions
  extends Omit<DynamoDBClientConfig, 'logger'>,
    BaseEntityClientOptions {
  /** Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment. */
  enableXray?: boolean;
}
