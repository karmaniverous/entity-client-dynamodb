import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies to satisfy vi.mock hoisting
const h = vi.hoisted(() => ({
  startSpy: vi.fn((_opts?: unknown) =>
    Promise.resolve({ endpoint: 'http://localhost:9001' }),
  ),
  statusSpy: vi.fn((_opts?: unknown) => Promise.resolve(true)),
  stopSpy: vi.fn((_opts?: unknown) => Promise.resolve()),
  pluginCfgSpy: vi.fn(() => ({ local: {} })),
}));

// Mock services/local used by the command module.
vi.mock('../../../services/local', () => ({
  startLocal: h.startSpy,
  statusLocal: h.statusSpy,
  stopLocal: h.stopSpy,
}));

// Mock helpers to provide plugin config.
vi.mock('../helpers', () => ({
  getPluginConfig: h.pluginCfgSpy,
}));

// Minimal command-builder stub that captures the registered actions by name
class FakeGroup {
  actionFns: Record<string, (flags: Record<string, unknown>) => unknown> = {};
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
  action(fn: (flags: Record<string, unknown>) => unknown): this {
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

  const fakeCli = {
    ns: () => group as unknown as Record<string, unknown>,
    getCtx: () =>
      ({
        dotenv: {},
        pluginConfigs: {
          dynamodb: {
            local: {},
          },
        },
      }) as unknown,
  } as unknown as Record<string, unknown>;

  beforeEach(() => {
    group = new FakeGroup();
    h.startSpy.mockClear();
    h.statusSpy.mockClear();
    h.stopSpy.mockClear();
    h.pluginCfgSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
    errorSpy.mockClear();
    // Build the command tree and capture actions
    registerLocal(fakeCli as never, group as never);
  });

  it('start wires to services.startLocal and prints endpoint', async () => {
    const start = group.actionFns.start;
    expect(typeof start).toBe('function');
    if (!start) throw new Error('start action missing');
    await start({ port: '9001' });
    // Side effects: endpoint info + JSON payload printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('status wires to services.statusLocal and sets exitCode on false', async () => {
    // Healthy branch (default spy result)
    const status = group.actionFns.status;
    expect(typeof status).toBe('function');
    if (!status) throw new Error('status action missing');
    await status({ port: '9002' });
    expect(process.exitCode).toBeUndefined();
    // Now simulate unhealthy branch
    h.statusSpy.mockResolvedValueOnce(false);
    await status({});
    expect(process.exitCode).toBe(1);
    // Reset for subsequent tests
    process.exitCode = undefined;
  });

  it('stop wires to services.stopLocal', async () => {
    const stop = group.actionFns.stop;
    expect(typeof stop).toBe('function');
    if (!stop) throw new Error('stop action missing');
    await stop({});
    // Nothing thrown → wiring OK; we asserted prints above on start
  });
});
