import { z } from '@karmaniverous/get-dotenv/cliHost';

/**
 * Zod schema for the DynamoDB plugin config slice.
 *
 * Notes:
 * - The host deep-interpolates plugin config strings once before plugin code runs.
 * - We accept number-or-string for numeric fields because interpolated values may
 *   arrive as strings when authored via env expansion.
 */
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
 * DynamoDB plugin config slice (validated by {@link DynamodbPluginConfigSchema | `DynamodbPluginConfigSchema`}).
 *
 * @category get-dotenv
 */
export type DynamodbPluginConfig = z.infer<typeof DynamodbPluginConfigSchema>;
