import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock execaCommand used by services/local
const h = vi.hoisted(() => ({
  execaOk: vi.fn(() => Promise.resolve({})),
  execaFail: vi.fn(() => Promise.reject(new Error('fail'))),
}));
vi.mock('execa', () => ({
  // Keep the mock signature simple to avoid TS2556; we just signal success/failure.
  execaCommand: (cmd: string, opts?: unknown) => h.execaOk(cmd, opts),
}));

import { deriveEndpoint, statusLocal } from './local';

describe('local services', () => {
  beforeEach(() => {
    h.execaOk.mockClear();
    h.execaFail.mockClear();
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
      expect(h.execaOk).toHaveBeenCalledTimes(1);
    });
    it('returns false when execaCommand fails', async () => {
      // Rewire execa mock to fail for this test
      h.execaOk.mockImplementationOnce(() => Promise.reject(new Error('fail')));
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
