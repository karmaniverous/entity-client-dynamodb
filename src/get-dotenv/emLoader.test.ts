import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveAndLoadEntityManager } from './emLoader';
import type { VersionedLayoutConfig } from './layout';

const jsModule = (body: string) =>
  `module.exports = ${body};\nmodule.exports.default = module.exports;`;

describe('get-dotenv EM loader', function () {
  it('should load EM from current version when present', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '001'), { recursive: true });

    const emPath = join(root, '001', 'entityManager.js');
    const emBody = `() => ({ config: { hashKey: 'hashKey', rangeKey: 'rangeKey' } })`;
    await fs.writeFile(emPath, jsModule(emBody), 'utf8');

    const em = await resolveAndLoadEntityManager('001', cfg);
    expect(!!em && typeof em === 'object' && 'config' in em).to.equal(true);
  });

  it('should fall back to earlier version when current has no EM', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '000'), { recursive: true });
    await fs.mkdir(join(root, '005'), { recursive: true });

    const emPath = join(root, '000', 'entityManager.js');
    const emBody = `() => ({ config: { hashKey: 'hashKey', rangeKey: 'rangeKey' } })`;
    await fs.writeFile(emPath, jsModule(emBody), 'utf8');

    const em = await resolveAndLoadEntityManager('005', cfg);
    expect(!!em && typeof em === 'object' && 'config' in em).to.equal(true);
  });

  it('should error when no EM can be resolved across ancestry', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '010'), { recursive: true });

    await expect(resolveAndLoadEntityManager('010', cfg)).rejects.toThrow(
      /no entityManager module found/,
    );
  });
});
