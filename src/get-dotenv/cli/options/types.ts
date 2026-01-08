export type { DynamodbPluginConfig } from './schema';

// Flag shapes (re-exported from each resolver module too)

/**
 * Managed table properties flags (generate).
 *
 * @category get-dotenv
 */
export interface GenerateFlagsTableProperties {
  /** Billing mode (e.g. `PAY_PER_REQUEST` or `PROVISIONED`). */
  billingMode?: string;
  /** Provisioned RCU (requires billingMode=PROVISIONED). */
  readCapacityUnits?: number | string;
  /** Provisioned WCU (requires billingMode=PROVISIONED). */
  writeCapacityUnits?: number | string;
  /** Managed `Properties.TableName`. */
  tableName?: string;
}

/**
 * Raw CLI flags for `generate` (before merge/expansion).
 *
 * @category get-dotenv
 */
export interface GenerateFlags {
  /** Target version (NNN). */
  version?: string;
  /** When true, recompose from baseline template + generated + managed props. */
  clean?: boolean;
  /** Managed table properties to apply deterministically. */
  tableProperties?: GenerateFlagsTableProperties;
}

/**
 * Raw CLI flags for `validate` (before merge/expansion).
 *
 * @category get-dotenv
 */
export interface ValidateFlags {
  /** Target version (NNN). */
  version?: string;
}
