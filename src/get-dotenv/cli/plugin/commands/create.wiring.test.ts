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
    const emCalls = h.emSpy.mock.calls as readonly (readonly unknown[])[];
    const emCall = emCalls.length > 0 ? emCalls[0] : ([] as const);
    expect(emCall[0]).toBe('001');

    // buildEntityClient constructed client for the override table
    expect(h.buildSpy).toHaveBeenCalled();
    const buildCalls = h.buildSpy.mock.calls as readonly (readonly [
      unknown,
      string,
    ])[];
    const buildSelected: readonly [unknown, string] =
      buildCalls.length > 0 ? buildCalls[0] : [undefined, '' as string];
    const emArg = buildSelected[0];
    const tblArg = buildSelected[1];
    expect(typeof emArg).toBe('object');
    expect(tblArg).toBe('MyTbl');

    // createTableAtVersion called with resolved waiter and options
    expect(h.createSpy).toHaveBeenCalledTimes(1);
    const createCalls = h.createSpy.mock
      .calls as readonly (readonly unknown[])[];
    const createArgs = createCalls.length > 0 ? createCalls[0] : ([] as const);
    // args: client, em, version, cfg, options
    expect(createArgs[2]).toBe('001');
    const optionsArg = createArgs[4] as Record<string, unknown> | undefined;
    expect(optionsArg).toMatchObject({
      tableNameOverride: 'MyTbl',
      waiter: { maxWaitTime: 5 },
    });

    // Outputs were printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
