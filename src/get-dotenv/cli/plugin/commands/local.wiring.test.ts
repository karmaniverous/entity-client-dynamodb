import { GetDotenvCli } from '@karmaniverous/get-dotenv/cliHost';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies to satisfy vi.mock hoisting
const h = vi.hoisted(() => ({
  startSpy: vi.fn(() => Promise.resolve({ endpoint: 'http://localhost:9001' })),
  statusSpy: vi.fn(() => Promise.resolve(true)),
  stopSpy: vi.fn(() => Promise.resolve()),
}));

// Mock services/local used by the command module.
vi.mock('../../../services/local', () => ({
  startLocal: h.startSpy,
  statusLocal: h.statusSpy,
  stopLocal: h.stopSpy,
}));

async function setupCli() {
  const cli = await makeCli();
  await cli.install();
  await cli.resolveAndLoad();
  return cli;
}

async function makeCli() {
  // Important: import the plugin only after vi.mock declarations so that
  // the command modules pick up mocked leaf services.
  const { dynamodbPlugin } = await import('../index');
  const cli = new GetDotenvCli('testcli');
  // Keep the host minimal and deterministic for tests.
  cli.attachRootOptions({ loadProcess: false, log: false });
  cli.use(dynamodbPlugin());
  return cli;
}

describe('dynamodb plugin: local wiring', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const errorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const prevStdio = process.env.GETDOTENV_STDIO;

  beforeEach(() => {
    h.startSpy.mockClear();
    h.statusSpy.mockClear();
    h.stopSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
    errorSpy.mockClear();
    process.exitCode = undefined;
  });

  afterEach(() => {
    if (prevStdio === undefined) delete process.env.GETDOTENV_STDIO;
    else process.env.GETDOTENV_STDIO = prevStdio;
  });

  it('start wires to services.startLocal and prints endpoint', async () => {
    process.env.GETDOTENV_STDIO = 'pipe';
    const cli = await setupCli();
    await cli.parseAsync([
      'node',
      'testcli',
      'dynamodb',
      'local',
      'start',
      '--port',
      '9001',
    ]);

    expect(h.startSpy).toHaveBeenCalledTimes(1);
    expect(h.startSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        capture: true,
        portOverride: 9001,
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('status wires to services.statusLocal and sets exitCode on false', async () => {
    // Healthy branch (default spy result)
    const cliHealthy = await setupCli();
    await cliHealthy.parseAsync([
      'node',
      'testcli',
      'dynamodb',
      'local',
      'status',
      '--port',
      '9002',
    ]);
    expect(h.statusSpy).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    // Now simulate unhealthy branch
    process.exitCode = undefined;
    h.statusSpy.mockResolvedValueOnce(false);
    const cliUnhealthy = await setupCli();
    await cliUnhealthy.parseAsync([
      'node',
      'testcli',
      'dynamodb',
      'local',
      'status',
      '--port',
      '9002',
    ]);
    expect(process.exitCode).toBe(1);
  });

  it('stop wires to services.stopLocal', async () => {
    const cli = await setupCli();
    await cli.parseAsync(['node', 'testcli', 'dynamodb', 'local', 'stop']);
    expect(h.stopSpy).toHaveBeenCalledTimes(1);
  });
});
