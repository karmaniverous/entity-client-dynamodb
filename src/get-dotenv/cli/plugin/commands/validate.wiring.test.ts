import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies to satisfy Vitest's hoisting of vi.mock
const h = vi.hoisted(() => ({
  validateSpy: vi.fn(() =>
    Promise.resolve({
      tablePath: '/tables/001/table.yml',
      equal: true,
      diffs: [],
    }),
  ),
}));
// Mock the validate service used by the command module.
vi.mock('../../../services/validateTable', () => ({
  validateTableDefinitionAtVersion: h.validateSpy,
}));

// Minimal command-builder stub that captures the registered action.
class FakeGroup {
  actionFn?: (flags: Record<string, unknown>) => unknown;
  command() {
    return this;
  }
  description(desc: string) {
    // mark used to satisfy lint
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
import { registerValidate } from './validate';

describe('dynamodb plugin: validate wiring', () => {
  let group: FakeGroup;
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const plugin = { readConfig: () => ({}) };
  const fakeCli = {
    // Only ns and getCtx are used by registerValidate
    ns: () => group as unknown as Record<string, unknown>,
    getCtx: () =>
      ({
        dotenv: {},
      }) as unknown,
  } as unknown as Record<string, unknown>;

  beforeEach(() => {
    group = new FakeGroup();
    h.validateSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
  });

  it('registers validate action and calls service with resolved args', async () => {
    registerValidate(plugin as never, fakeCli as never, group as never);
    expect(typeof group.actionFn).toBe('function');
    await group.actionFn?.({ version: '001' });

    // Service called with version and a config object
    expect(h.validateSpy).toHaveBeenCalledTimes(1);
    const calls = h.validateSpy.mock.calls as readonly (readonly unknown[])[];
    const callArgs = calls.length > 0 ? calls[0] : ([] as const);
    const versionArg = callArgs[0];
    const cfgArg = callArgs[1] as Record<string, unknown> | undefined;
    expect(versionArg).toBe('001');
    expect(typeof cfgArg).toBe('object');

    // Outputs were printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
