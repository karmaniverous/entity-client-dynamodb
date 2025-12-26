import { z } from '@karmaniverous/get-dotenv/cliHost';

/**
 * Zod schema for the DynamoDB plugin config slice.
 *
 * @internal
 */
export const DynamodbPluginConfigSchema = z
  .object({
    tablesPath: z.string().optional(),
    minTableVersionWidth: z.union([z.number(), z.string()]).optional(),
    tokens: z
      .object({
        table: z.string().optional(),
        entityManager: z.string().optional(),
        transform: z.string().optional(),
      })
      .optional(),
    local: z
      .object({
        port: z.union([z.number(), z.string()]).optional(),
        endpoint: z.string().optional(),
        start: z.string().optional(),
        stop: z.string().optional(),
        status: z.string().optional(),
      })
      .optional(),
    generate: z
      .object({
        version: z.string().optional(),
        tableProperties: z
          .object({
            billingMode: z.string().optional(),
            readCapacityUnits: z.union([z.number(), z.string()]).optional(),
            writeCapacityUnits: z.union([z.number(), z.string()]).optional(),
            tableName: z.string().optional(),
          })
          .optional(),
        clean: z.boolean().optional(),
      })
      .optional(),
    validate: z.object({ version: z.string().optional() }).optional(),
    create: z
      .object({
        version: z.string().optional(),
        validate: z.boolean().optional(),
        refreshGenerated: z.boolean().optional(),
        force: z.boolean().optional(),
        waiter: z
          .object({ maxSeconds: z.union([z.number(), z.string()]).optional() })
          .optional(),
        tableNameOverride: z.string().optional(),
      })
      .optional(),
    delete: z
      .object({
        tableName: z.string().optional(),
        waiter: z
          .object({ maxSeconds: z.union([z.number(), z.string()]).optional() })
          .optional(),
      })
      .optional(),
    purge: z.object({ tableName: z.string().optional() }).optional(),
    migrate: z
      .object({
        sourceTable: z.string().optional(),
        targetTable: z.string().optional(),
        fromVersion: z.string().optional(),
        toVersion: z.string().optional(),
        pageSize: z.union([z.number(), z.string()]).optional(),
        limit: z.union([z.number(), z.string()]).optional(),
        transformConcurrency: z.union([z.number(), z.string()]).optional(),
        progressIntervalMs: z.union([z.number(), z.string()]).optional(),
      })
      .optional(),
  })
  .strip();

/**
 * DynamoDB plugin config slice.
 *
 * @remarks
 * This is the public, documented config shape for the DynamoDB get-dotenv plugin.
 * The schema value is intentionally not part of the exported docs surface; consumers should configure via this type.
 *
 * @category get-dotenv
 */
export interface DynamodbPluginConfig {
  /** Root path for versioned assets (default: `"tables"`). */
  tablesPath?: string;
  /** Minimum width for left-zero padding when formatting version tokens (default: `3`). */
  minTableVersionWidth?: number | string;
  /** Filename tokens (without extensions) for the versioned layout. */
  tokens?: {
    /** Table definition token (default: `"table"`). */
    table?: string;
    /** EntityManager module token (default: `"entityManager"`). */
    entityManager?: string;
    /** Transform module token (default: `"transform"`). */
    transform?: string;
  };
  /** Local DynamoDB orchestration config (config-first; embedded fallback). */
  local?: {
    /** Local port (used for endpoint derivation). */
    port?: number | string;
    /** Endpoint override (e.g., `"http://localhost:8000"`). */
    endpoint?: string;
    /** Shell command to start local DynamoDB. */
    start?: string;
    /** Shell command to stop local DynamoDB. */
    stop?: string;
    /** Shell command to check local DynamoDB status (exit 0 = healthy). */
    status?: string;
  };
  /** Defaults for `generate` (compose/refresh `table.yml`). */
  generate?: {
    /** Default version token (NNN). */
    version?: string;
    /** Managed (tooling-controlled) table Properties (non-generated keys). */
    tableProperties?: {
      /** Billing mode (e.g., `"PAY_PER_REQUEST"` or `"PROVISIONED"`). */
      billingMode?: string;
      /** Provisioned RCU (requires billingMode=`"PROVISIONED"`). */
      readCapacityUnits?: number | string;
      /** Provisioned WCU (requires billingMode=`"PROVISIONED"`). */
      writeCapacityUnits?: number | string;
      /** Managed `Properties.TableName`. */
      tableName?: string;
    };
    /** When `true`, regenerate from baseline template + generated + managed properties. */
    clean?: boolean;
  };
  /** Defaults for `validate`. */
  validate?: {
    /** Default version token (NNN). */
    version?: string;
  };
  /** Defaults for `create`. */
  create?: {
    /** Default version token (NNN). */
    version?: string;
    /** Validate drift before create. */
    validate?: boolean;
    /** Refresh generated sections in place before create. */
    refreshGenerated?: boolean;
    /** Proceed on drift when validation fails. */
    force?: boolean;
    /** Waiter configuration for table create. */
    waiter?: {
      /** Max waiter duration in seconds. */
      maxSeconds?: number | string;
    };
    /** One-off TableName override (does not persist to YAML). */
    tableNameOverride?: string;
  };
  /** Defaults for `delete`. */
  delete?: {
    /** Default table name (dotenv-expanded by the host). */
    tableName?: string;
    /** Waiter configuration for table delete. */
    waiter?: {
      /** Max waiter duration in seconds. */
      maxSeconds?: number | string;
    };
  };
  /** Defaults for `purge`. */
  purge?: {
    /** Default table name (dotenv-expanded by the host). */
    tableName?: string;
  };
  /** Defaults for `migrate`. */
  migrate?: {
    /** Source table name (dotenv-expanded by the host). */
    sourceTable?: string;
    /** Target table name (dotenv-expanded by the host). */
    targetTable?: string;
    /** From version token (NNN; exclusive). */
    fromVersion?: string;
    /** To version token (NNN; inclusive). */
    toVersion?: string;
    /** DynamoDB scan page size. */
    pageSize?: number | string;
    /** Max outputs to write. */
    limit?: number | string;
    /** Transform concurrency within a page. */
    transformConcurrency?: number | string;
    /** Progress tick interval in ms. */
    progressIntervalMs?: number | string;
  };
}
