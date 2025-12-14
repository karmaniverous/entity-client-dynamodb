import { EntityClient } from '../../../EntityClient';

/** Build an EntityClient from envRef and a resolved tableName. */
export function buildEntityClient(
  em: unknown,
  tableName: string,
  envRef: Record<string, string | undefined> = process.env,
) {
  // Explicit endpoint overrides only. Do not default to localhost here:
  // this plugin may run as a child of the aws parent plugin (real AWS).
  const endpoint =
    envRef.AWS_ENDPOINT_URL_DYNAMODB ??
    envRef.DYNAMODB_ENDPOINT ??
    envRef.DYNAMODB_LOCAL_ENDPOINT ??
    undefined;

  const hasEnvCreds =
    !!envRef.AWS_ACCESS_KEY_ID && !!envRef.AWS_SECRET_ACCESS_KEY;

  const region =
    envRef.AWS_REGION ??
    envRef.AWS_DEFAULT_REGION ??
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
