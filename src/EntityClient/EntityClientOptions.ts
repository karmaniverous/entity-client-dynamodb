import { type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import type { XrayMode } from '@karmaniverous/aws-xray-tools';
import {
  type BaseConfigMap,
  type BaseEntityClientOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type EntityManager, // imported to support API docs
} from '@karmaniverous/entity-manager';

/**
 * DynamoDB EntityClient options. Extends {@link BaseEntityClientOptions | `BaseEntityClientOptions`} and {@link DynamoDBClientConfig | `DynamoDBClientConfig`} with the following additional properties:
 * - `[xray]` - AWS X-Ray capture mode for the internal DynamoDB client.
 * - `entityManager` - {@link EntityManager | `EntityManager`} instance.
 * - `tableName` - Table name.
 *
 * @typeParam C - Entity-manager config map.
 * @typeParam CF - Values-first config literal type carried by {@link EntityManager | `EntityManager`} and threaded through {@link BaseEntityClientOptions | `BaseEntityClientOptions`}.
 *
 * @category EntityClient
 */
export interface EntityClientOptions<C extends BaseConfigMap, CF = unknown>
  extends BaseEntityClientOptions<C, CF>, Omit<DynamoDBClientConfig, 'logger'> {
  /**
   * AWS X-Ray capture mode for the internal DynamoDB client.
   *
   * @remarks
   * This uses {@link XrayMode | `XrayMode`} semantics from `@karmaniverous/aws-xray-tools`:
   * - `'off'`: never capture
   * - `'auto'`: capture only when `AWS_XRAY_DAEMON_ADDRESS` is set
   * - `'on'`: force capture (requires `AWS_XRAY_DAEMON_ADDRESS`)
   *
   * Default: `'off'`.
   */
  xray?: XrayMode | undefined;

  /** Table name. */
  tableName: string;
}
