import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies to satisfy vi.mock hoisting
const h = vi.hoisted(() => ({
  emSpy: vi.fn(() => Promise.resolve({})),
  createSpy: vi.fn(() =>
    Promise.resolve({ waiterResult: { state: 'SUCCESS' as const } }),
  ),
  buildSpy: vi.fn((_em: unknown, tableName: string) => ({ tableName })),
  pluginCfgSpy: vi.fn(() => ({})),
}));
// Mocks for dependencies used by the command module.
vi.mock('../../../emLoader', () => ({
  resolveAndLoadEntityManager: h.emSpy,
}));
vi.mock('../../../services/create', () => ({
  createTableAtVersion: h.createSpy,
}));
// Mock helpers to avoid constructing a real AWS client.
vi.mock('../helpers', () => ({
  buildEntityClient: h.buildSpy,
  getPluginConfig: h.pluginCfgSpy,
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
import { registerCreate } from './create';

describe('dynamodb plugin: create wiring', () => {
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
    h.createSpy.mockClear();
    h.buildSpy.mockClear();
    h.pluginCfgSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
  });

  it('registers create action and calls service with resolved args', async () => {
    registerCreate(fakeCli as never, group as never);
    expect(typeof group.actionFn).toBe('function');
    await group.actionFn?.({
      version: '001',
      tableNameOverride: 'MyTbl',
      maxSeconds: '5',
      validate: true,
    });

    // resolveAndLoadEntityManager called for version
    expect(h.emSpy).toHaveBeenCalledTimes(1);
    const emCall = h.emSpy.mock.calls.at(0) ?? [];
    expect(emCall[0]).toBe('001');

    // buildEntityClient constructed client for the override table
    expect(h.buildSpy).toHaveBeenCalled();
    const buildArgs = h.buildSpy.mock.calls.at(0) ?? [];
    const emArg = buildArgs[0];
    const tblArg = buildArgs[1] as string;
    expect(typeof emArg).toBe('object');
    expect(tblArg).toBe('MyTbl');

    // createTableAtVersion called with resolved waiter and options
    expect(h.createSpy).toHaveBeenCalledTimes(1);
    const createArgs = h.createSpy.mock.calls.at(0) ?? [];
    // args: client, em, version, cfg, options
    expect(createArgs[2]).toBe('001');
    expect(createArgs[4]).toMatchObject({
      tableNameOverride: 'MyTbl',
      waiter: { maxWaitTime: 5 },
    });

    // Outputs were printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
