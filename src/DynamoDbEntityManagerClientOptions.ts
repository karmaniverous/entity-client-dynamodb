import type { EntityManagerClientOptions } from '@karmaniverous/entity-manager';

/**
 * Entity Manager DynamoDB client options.
 */
export interface DynamoDbEntityManagerClientOptions
  extends EntityManagerClientOptions {
  /** Activates AWS Xray for internal DynamoDb client when `true` and running in a Lambda environment. */
  enableXray?: boolean;
}
