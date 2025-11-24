import type { GetDotenvCliPublic } from '@karmaniverous/get-dotenv/cliHost';

import { EntityClient } from '../../../EntityClient';
import type { DynamodbPluginConfig } from '../options';

/** Read the plugin config slice from the host context. */
export function getPluginConfig(cli: GetDotenvCliPublic): DynamodbPluginConfig {
  const cfg = cli.getCtx()?.pluginConfigs?.dynamodb;
  return (cfg ?? {}) as DynamodbPluginConfig;
}

/** Build an EntityClient from envRef and a resolved tableName. */
export function buildEntityClient(
  em: unknown,
  tableName: string,
  envRef: Record<string, string | undefined> = process.env,
) {
  const region = envRef.AWS_REGION ?? envRef.AWS_DEFAULT_REGION ?? 'local';
  const endpoint =
    envRef.AWS_ENDPOINT_URL_DYNAMODB ??
    envRef.DYNAMODB_ENDPOINT ??
    `http://localhost:${envRef.DYNAMODB_LOCAL_PORT ?? '8000'}`;
  const credentials = {
    accessKeyId: envRef.AWS_ACCESS_KEY_ID ?? 'fake',
    secretAccessKey: envRef.AWS_SECRET_ACCESS_KEY ?? 'fake',
  };
  return new EntityClient({
    entityManager: em as never,
    tableName,
    region,
    endpoint,
    credentials,
  });
}

/**
 * Non-interactive confirm guard for destructive ops.
 * Returns true when force is provided; otherwise warns and sets exitCode.
 */
export function ensureForce(force: unknown, op: string): boolean {
  if (force) return true;
  console.warn(`${op} requires confirmation. Re-run with --force to proceed.`);
  process.exitCode = 2;
  return false;
}
