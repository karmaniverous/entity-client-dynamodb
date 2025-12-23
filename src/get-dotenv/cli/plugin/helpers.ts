import { EntityClient } from '../../../EntityClient';

/**
 * Build an EntityClient from a resolved table name and an env overlay.
 *
 * Note: this plugin is commonly mounted under the shipped aws plugin. The aws parent writes region/credentials into
 * `process.env`, so we always merge `{ ...process.env, ...envRef }` (envRef wins) to ensure the child sees those values.
 *
 * @param em - EntityManager instance (or compatible).
 * @param tableName - Resolved table name.
 * @param envRef - Env overlay (typically ctx.dotenv).
 * @returns A configured EntityClient.
 */
export function buildEntityClient(
  em: unknown,
  tableName: string,
  envRef: Record<string, string | undefined> = process.env,
) {
  const env = { ...process.env, ...envRef };
  // Explicit endpoint overrides only. Do not default to localhost here:
  // this plugin may run as a child of the aws parent plugin (real AWS).
  const endpoint =
    env.AWS_ENDPOINT_URL_DYNAMODB ??
    env.DYNAMODB_ENDPOINT ??
    env.DYNAMODB_LOCAL_ENDPOINT ??
    undefined;

  const hasEnvCreds = !!env.AWS_ACCESS_KEY_ID && !!env.AWS_SECRET_ACCESS_KEY;

  const region =
    env.AWS_REGION ??
    env.AWS_DEFAULT_REGION ??
    (endpoint ? 'local' : 'us-east-1');

  return new EntityClient({
    entityManager: em as never,
    tableName,
    region,
    ...(endpoint ? { endpoint } : {}),
    ...(hasEnvCreds
      ? {}
      : endpoint
        ? {
            credentials: {
              accessKeyId: 'fake',
              secretAccessKey: 'fake',
            },
          }
        : {}),
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
