import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks for dependencies used by the command module.
const emSpy = vi.fn(async () => ({}));
vi.mock('../../../emLoader', () => ({
  resolveAndLoadEntityManager: emSpy,
}));

const createSpy = vi.fn(async () => ({
  waiterResult: { state: 'SUCCESS' as const },
}));
vi.mock('../../../services/create', () => ({
  createTableAtVersion: createSpy,
}));

// Mock helpers to avoid constructing a real AWS client.
const buildSpy = vi.fn((_em: unknown, tableName: string) => ({ tableName }));
const pluginCfgSpy = vi.fn(() => ({}));
vi.mock('../helpers', async (orig) => {
  const mod = await orig();
  return {
    ...(mod as object),
    buildEntityClient: buildSpy,
    getPluginConfig: pluginCfgSpy,
  };
});

// Minimal command-builder stub that captures the registered action.
class FakeGroup {
  actionFn?: (flags: Record<string, unknown>) => unknown;
  command() {
    return this;
  }
  description(_: string) {
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
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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
    emSpy.mockClear();
    createSpy.mockClear();
    buildSpy.mockClear();
    pluginCfgSpy.mockClear();
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
    expect(emSpy).toHaveBeenCalledTimes(1);
    const [ver] = emSpy.mock.calls[0] as [unknown];
    expect(ver).toBe('001');

    // buildEntityClient constructed client for the override table
    expect(buildSpy).toHaveBeenCalled();
    const [emArg, tblArg] = buildSpy.mock.calls[0] as [unknown, string];
    expect(typeof emArg).toBe('object');
    expect(tblArg).toBe('MyTbl');

    // createTableAtVersion called with resolved waiter and options
    expect(createSpy).toHaveBeenCalledTimes(1);
    const createArgs = createSpy.mock.calls[0] as unknown[];
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
