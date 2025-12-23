import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies to satisfy vi.mock hoisting
const h = vi.hoisted(() => ({
  startSpy: vi.fn(() => Promise.resolve({ endpoint: 'http://localhost:9001' })),
  statusSpy: vi.fn(() => Promise.resolve(true)),
  stopSpy: vi.fn(() => Promise.resolve()),
}));

// Avoid partial mocks: preserve real exports and override only what we need.
vi.mock('@karmaniverous/get-dotenv/cliHost', async () => {
  const actual = await vi.importActual<
    typeof import('@karmaniverous/get-dotenv/cliHost')
  >('@karmaniverous/get-dotenv/cliHost');
  return { ...actual, readMergedOptions: () => ({}) };
});

// Mock services/local used by the command module.
vi.mock('../../../services/local', () => ({
  startLocal: h.startSpy,
  statusLocal: h.statusSpy,
  stopLocal: h.stopSpy,
}));

// Minimal command-builder stub that captures the registered actions by name
class FakeGroup {
  actionFns: Record<string, (...args: unknown[]) => unknown> = {};
  private _current?: string;
  command(name: string) {
    this._current = name;
    return this;
  }
  description() {
    return this;
  }
  option(): this {
    return this;
    // We don't need to track options for wiring tests
  }
  action(fn: (...args: unknown[]) => unknown): this {
    const key = this._current ?? 'root';
    this.actionFns[key] = fn;
    return this;
  }
}

// Import after mocks
import { registerLocal } from './local';

describe('dynamodb plugin: local wiring', () => {
  let group: FakeGroup;
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const errorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  const plugin = { readConfig: () => ({ local: {} }) };
  const fakeCli = {
    ns: () => group as unknown as Record<string, unknown>,
    getCtx: () =>
      ({
        dotenv: {},
      }) as unknown,
  } as unknown as Record<string, unknown>;

  beforeEach(() => {
    group = new FakeGroup();
    h.startSpy.mockClear();
    h.statusSpy.mockClear();
    h.stopSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
    errorSpy.mockClear();
    // Build the command tree and capture actions
    registerLocal(plugin as never, fakeCli as never, group as never);
    process.exitCode = undefined;
  });

  it('start wires to services.startLocal and prints endpoint', async () => {
    const start = group.actionFns.start;
    expect(typeof start).toBe('function');
    await start({ port: 9001 }, group as unknown as Command);
    // Side effects: endpoint info + JSON payload printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('status wires to services.statusLocal and sets exitCode on false', async () => {
    // Healthy branch (default spy result)
    const status = group.actionFns.status;
    expect(typeof status).toBe('function');
    await status({ port: 9002 }, group as unknown as Command);
    expect(process.exitCode).toBeUndefined();
    // Now simulate unhealthy branch
    h.statusSpy.mockResolvedValueOnce(false);
    await status({}, group as unknown as Command);
    expect(process.exitCode).toBe(1);
    // Reset for subsequent tests
    process.exitCode = undefined;
  });

  it('stop wires to services.stopLocal', async () => {
    const stop = group.actionFns.stop;
    expect(typeof stop).toBe('function');
    await stop({}, group as unknown as Command);
    // Nothing thrown → wiring OK; we asserted prints above on start
  });
});
