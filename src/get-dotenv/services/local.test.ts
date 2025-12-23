import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock get-dotenv host exec helpers used by services/local
const h = vi.hoisted(() => ({
  runOk: vi.fn(() => Promise.resolve(0)),
  runFail: vi.fn(() => Promise.reject(new Error('fail'))),
  runResultOk: vi.fn(() =>
    Promise.resolve({ exitCode: 0, stdout: '', stderr: '' }),
  ),
}));

vi.mock('@karmaniverous/get-dotenv/cliHost', () => ({
  runCommand: () => h.runOk(),
  runCommandResult: () => h.runResultOk(),
}));

import { deriveEndpoint, statusLocal } from './local';

describe('local services', () => {
  beforeEach(() => {
    h.runOk.mockClear();
    h.runFail.mockClear();
    h.runResultOk.mockClear();
  });

  describe('deriveEndpoint', () => {
    it('prefers cfg.endpoint when present', () => {
      const out = deriveEndpoint(
        { endpoint: 'http://localhost:7777' },
        { DYNAMODB_LOCAL_PORT: '9000' },
      );
      expect(out.endpoint).toEqual('http://localhost:7777');
      // port remains computed (env/cfg) but endpoint wins
      expect(typeof out.port).toEqual('number');
    });
    it('falls back to cfg.port and env var', () => {
      const out1 = deriveEndpoint({ port: 1234 }, {});
      expect(out1.endpoint).toEqual('http://localhost:1234');
      expect(out1.port).toEqual(1234);

      const out2 = deriveEndpoint(undefined, { DYNAMODB_LOCAL_PORT: '9999' });
      expect(out2.endpoint).toEqual('http://localhost:9999');
      expect(out2.port).toEqual(9999);
    });
  });

  describe('statusLocal (config-driven)', () => {
    it('returns true when execaCommand succeeds', async () => {
      const ok = await statusLocal({
        cfg: { status: 'echo ok' },
        envRef: {},
        shell: false,
        capture: false,
      });
      expect(ok).toEqual(true);
      expect(h.runOk).toHaveBeenCalledTimes(1);
    });
    it('returns false when execaCommand fails', async () => {
      // Rewire runCommand mock to fail for this test
      h.runOk.mockImplementationOnce(() => Promise.reject(new Error('fail')));
      const ok = await statusLocal({
        cfg: { status: 'exit 1' },
        envRef: {},
        shell: false,
        capture: false,
      });
      expect(ok).toEqual(false);
    });
  });
});
