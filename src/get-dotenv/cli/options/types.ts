export type EnvRef = Record<string, string | undefined>;

/** Minimal plugin config surface (plugins.dynamodb). */
export interface DynamodbPluginConfig {
  tablesPath?: string;
  tokens?: {
    table?: string;
    entityManager?: string;
    transform?: string;
  };
  generate?: {
    version?: string;
    overlays?: {
      billingMode?: string;
      readCapacityUnits?: number;
      writeCapacityUnits?: number;
      tableName?: string;
    };
    force?: boolean;
  };
  validate?: {
    version?: string;
  };
  create?: {
    version?: string;
    validate?: boolean;
    refreshGenerated?: boolean;
    force?: boolean;
    waiter?: { maxSeconds?: number };
    tableNameOverride?: string;
  };
  delete?: {
    tableName?: string;
    waiter?: { maxSeconds?: number };
  };
  purge?: {
    tableName?: string;
  };
  migrate?: {
    sourceTable?: string;
    targetTable?: string;
    fromVersion?: string;
    toVersion?: string;
    pageSize?: number;
    limit?: number;
    transformConcurrency?: number;
    progressIntervalMs?: number;
  };
}

// Flag shapes (re-exported from each resolver module too)
export interface GenerateFlags {
  version?: string;
  force?: boolean;
  overlays?: {
    billingMode?: string;
    readCapacityUnits?: number | string;
    writeCapacityUnits?: number | string;
    tableName?: string;
  };
}

export interface ValidateFlags {
  version?: string;
}
