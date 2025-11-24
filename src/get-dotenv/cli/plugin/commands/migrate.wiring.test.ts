import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies to satisfy vi.mock hoisting
const h = vi.hoisted(() => ({
  emSpy: vi.fn(() => Promise.resolve({})),
  migrateSpy: vi.fn(() => Promise.resolve({ pages: 1, items: 2, outputs: 2 })),
  buildSpy: vi.fn((_em: unknown, tableName: string) => ({ tableName })),
  pluginCfgSpy: vi.fn(() => ({})),
}));

// Mocks for dependencies used by the command module.
vi.mock('../../../emLoader', () => ({
  resolveAndLoadEntityManager: h.emSpy,
}));
vi.mock('../../../services/migrate', () => ({
  migrateData: h.migrateSpy,
}));
// Mock helpers to avoid constructing a real AWS client.
vi.mock('../helpers', () => ({
  buildEntityClient: h.buildSpy,
  getPluginConfig: h.pluginCfgSpy,
  ensureForce: (force: unknown) => !!force,
}));

// Minimal command-builder stub that captures the registered action.
class FakeGroup {
  actionFn?: (flags: Record<string, unknown>) => unknown;
  command() {
    return this;
  }
  description(desc: string) {
    void desc;
    return this;
  }
  option(): this {
    return this;
  }
  action(fn: (flags: Record<string, unknown>) => unknown): this {
    this.actionFn = fn;
    return this;
  }
}

// Import after mocks
import { registerMigrate } from './migrate';

describe('dynamodb plugin: migrate wiring', () => {
  let group: FakeGroup;
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const fakeCli = {
    ns: () => group as unknown as Record<string, unknown>,
    getCtx: () =>
      ({
        dotenv: {},
        pluginConfigs: {
          dynamodb: {
            tablesPath: './tables',
          },
        },
      }) as unknown,
  } as unknown as Record<string, unknown>;

  beforeEach(() => {
    group = new FakeGroup();
    h.emSpy.mockClear();
    h.migrateSpy.mockClear();
    h.buildSpy.mockClear();
    h.pluginCfgSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
  });

  it('registers migrate action and calls service with resolved args', async () => {
    registerMigrate(fakeCli as never, group as never);
    expect(typeof group.actionFn).toBe('function');
    await group.actionFn?.({
      sourceTable: 'Source',
      targetTable: 'Target',
      fromVersion: '010',
      toVersion: '020',
      pageSize: '50',
      limit: '100',
      transformConcurrency: '2',
      progressIntervalMs: '5000',
      force: true,
    });

    // EM resolved for from and to versions
    expect(h.emSpy).toHaveBeenCalledTimes(2);
    const emCalls = h.emSpy.mock.calls as readonly (readonly unknown[])[];
    const firstCall = emCalls.length > 0 ? emCalls[0] : ([] as const);
    const secondCall = emCalls.length > 1 ? emCalls[1] : ([] as const);
    expect(firstCall[0]).toBe('010');
    expect(secondCall[0]).toBe('020');

    // Two clients built (source then target)
    expect(h.buildSpy).toHaveBeenCalledTimes(2);
    const buildCalls = h.buildSpy.mock.calls as readonly (readonly [
      unknown,
      string,
    ])[];
    const firstBuild: readonly [unknown, string] =
      buildCalls.length > 0 ? buildCalls[0] : [undefined, '' as string];
    const secondBuild: readonly [unknown, string] =
      buildCalls.length > 1 ? buildCalls[1] : [undefined, '' as string];
    expect(firstBuild[1]).toBe('Source');
    expect(secondBuild[1]).toBe('Target');

    // migrateData called with mapped options & onProgress
    expect(h.migrateSpy).toHaveBeenCalledTimes(1);
    const migCalls = h.migrateSpy.mock.calls as readonly (readonly unknown[])[];
    const migArgs = migCalls.length > 0 ? migCalls[0] : ([] as const);
    // args: source, target, options
    const optionsArg = migArgs[2] as Record<string, unknown> | undefined;
    expect(optionsArg).toMatchObject({
      fromVersion: '010',
      toVersion: '020',
      pageSize: 50,
      limit: 100,
      transformConcurrency: 2,
      progressIntervalMs: 5000,
    });
    // progress callback should be a function if present
    if (optionsArg && 'onProgress' in optionsArg) {
      expect(typeof (optionsArg as { onProgress?: unknown }).onProgress).toBe(
        'function',
      );
    }

    // Outputs were printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
