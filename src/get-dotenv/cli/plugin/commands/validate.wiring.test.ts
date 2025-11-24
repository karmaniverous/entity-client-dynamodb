import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the validate service used by the command module.
const validateSpy = vi.fn(async () => ({
  tablePath: '/tables/001/table.yml',
  equal: true,
  diffs: [],
}));
vi.mock('../../../services/validateTable', () => ({
  validateTableDefinitionAtVersion: validateSpy,
}));

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
import { registerValidate } from './validate';

describe('dynamodb plugin: validate wiring', () => {
  let group: FakeGroup;
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  const fakeCli = {
    // Only ns and getCtx are used by registerValidate
    ns: () => group as unknown as Record<string, unknown>,
    getCtx: () =>
      ({
        dotenv: {},
        pluginConfigs: {
          dynamodb: {
            tablesPath: './tables',
            tokens: {
              table: 'table',
              entityManager: 'entityManager',
              transform: 'transform',
            },
          },
        },
      }) as unknown,
  } as unknown as Record<string, unknown>;

  beforeEach(() => {
    group = new FakeGroup();
    validateSpy.mockClear();
    infoSpy.mockClear();
    logSpy.mockClear();
  });

  it('registers validate action and calls service with resolved args', async () => {
    registerValidate(fakeCli as never, group as never);
    expect(typeof group.actionFn).toBe('function');
    await group.actionFn?.({ version: '001' });

    // Service called with version and a config object
    expect(validateSpy).toHaveBeenCalledTimes(1);
    const [versionArg, cfgArg] = validateSpy.mock.calls[0] as [
      unknown,
      unknown,
    ];
    expect(versionArg).toBe('001');
    expect(cfgArg).toMatchObject({ tablesPath: './tables' });

    // Outputs were printed
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
