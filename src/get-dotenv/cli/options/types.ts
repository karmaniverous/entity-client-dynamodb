export type EnvRef = Record<string, string | undefined>;

export type { DynamodbPluginConfig } from './schema';

// Flag shapes (re-exported from each resolver module too)
export interface GenerateFlags {
  version?: string;
  clean?: boolean;
  tableProperties?: {
    billingMode?: string;
    readCapacityUnits?: number | string;
    writeCapacityUnits?: number | string;
    tableName?: string;
  };
}

export interface ValidateFlags {
  version?: string;
}
