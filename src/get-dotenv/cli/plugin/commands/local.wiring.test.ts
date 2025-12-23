import { createCli } from '@karmaniverous/get-dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dynamodbPlugin } from '../index';

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

function makeRunner() {
  return createCli({
    alias: 'testcli',
    // Keep the host minimal and deterministic for tests.
    rootOptionDefaults: { loadProcess: false, log: false },
    compose: (p) => p.use(dynamodbPlugin()),
  });
}

function runWithNodePrefix(
  run: (argv?: string[]) => Promise<void>,
  argv: string[],
) {
  return run(['node', 'testcli', ...argv]);
}

describe('dynamodb plugin: local wiring', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const errorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  beforeEach(() => {
    h.startSpy.mockClear();
    h.statusSpy.mockClear();
    h.stopSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
    errorSpy.mockClear();
    process.exitCode = undefined;
  });

  it('start wires to services.startLocal and prints endpoint', async () => {
    const run = makeRunner();
    await runWithNodePrefix(run, [
      '--capture',
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
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('status wires to services.statusLocal and sets exitCode on false', async () => {
    const run = makeRunner();

    // Healthy branch (default spy result)
    await runWithNodePrefix(run, [
      'dynamodb',
      'local',
      'status',
      '--port',
      '9002',
    ]);
    expect(h.statusSpy).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    // Now simulate unhealthy branch
    h.statusSpy.mockResolvedValueOnce(false);
    await runWithNodePrefix(run, [
      'dynamodb',
      'local',
      'status',
      '--port',
      '9002',
    ]);
    expect(process.exitCode).toBe(1);
  });

  it('stop wires to services.stopLocal', async () => {
    const run = makeRunner();
    await runWithNodePrefix(run, ['dynamodb', 'local', 'stop']);
    expect(h.stopSpy).toHaveBeenCalledTimes(1);
  });
});
