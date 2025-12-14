import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies to satisfy vi.mock hoisting
const h = vi.hoisted(() => ({
  emSpy: vi.fn(() => Promise.resolve({})),
  deleteSpy: vi.fn(() =>
    Promise.resolve({ waiterResult: { state: 'SUCCESS' as const } }),
  ),
  buildSpy: vi.fn((_em: unknown, tableName: string) => ({ tableName })),
}));

// Mocks for dependencies used by the command module.
vi.mock('../../../emLoader', () => ({
  resolveAndLoadEntityManager: h.emSpy,
}));
vi.mock('../../../services/delete', () => ({
  deleteTable: h.deleteSpy,
}));
// Mock helpers to avoid constructing a real AWS client.
vi.mock('../helpers', () => ({
  buildEntityClient: h.buildSpy,
  // ensureForce is used as a guard; return true when force truthy
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
import { registerDelete } from './delete';

describe('dynamodb plugin: delete wiring', () => {
  let group: FakeGroup;
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const plugin = { readConfig: () => ({}) };
  const fakeCli = {
    ns: () => group as unknown as Record<string, unknown>,
    getCtx: () =>
      ({
        dotenv: {},
      }) as unknown,
  } as unknown as Record<string, unknown>;

  beforeEach(() => {
    group = new FakeGroup();
    h.emSpy.mockClear();
    h.deleteSpy.mockClear();
    h.buildSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
  });

  it('registers delete action and calls service with resolved args', async () => {
    registerDelete(plugin as never, fakeCli as never, group as never);
    expect(typeof group.actionFn).toBe('function');
    await group.actionFn?.({
      tableName: 'TargetTable',
      version: '010',
      maxSeconds: '7',
      force: true,
    });

    // resolveAndLoadEntityManager called for version
    expect(h.emSpy).toHaveBeenCalledTimes(1);
    const emCalls = h.emSpy.mock.calls as readonly (readonly unknown[])[];
    const emCall = emCalls.length > 0 ? emCalls[0] : ([] as const);
    expect(emCall[0]).toBe('010');

    // buildEntityClient constructed client for the override table
    expect(h.buildSpy).toHaveBeenCalled();
    const buildCalls = h.buildSpy.mock.calls as readonly (readonly [
      unknown,
      string,
    ])[];
    const buildSelected: readonly [unknown, string] =
      buildCalls.length > 0 ? buildCalls[0] : [undefined, '' as string];
    const tblArg = buildSelected[1];
    expect(tblArg).toBe('TargetTable');

    // deleteTable called with waiter and options
    expect(h.deleteSpy).toHaveBeenCalledTimes(1);
    const delCalls = h.deleteSpy.mock.calls as readonly (readonly unknown[])[];
    const delArgs = delCalls.length > 0 ? delCalls[0] : ([] as const);
    const optionsArg = delArgs[1] as Record<string, unknown> | undefined;
    expect(optionsArg).toMatchObject({
      waiter: { maxWaitTime: 7 },
    });

    // Outputs were printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
