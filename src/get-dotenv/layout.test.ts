import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  enumerateStepVersions,
  listVersionDirs,
  normalizeVersionToken,
  type VersionedLayoutConfig,
} from './layout';

describe('get-dotenv layout helpers', function () {
  it('normalizeVersionToken should accept numeric tokens and preserve padding', function () {
    expect(normalizeVersionToken('003')).to.equal('003');
    expect(() => normalizeVersionToken('a03')).to.throw(
      /invalid version token/,
    );
  });

  it('listVersionDirs should return sorted numeric directory names (NNN) only', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    await fs.mkdir(join(root, '000'));
    await fs.mkdir(join(root, '010'));
    await fs.mkdir(join(root, '002'));
    await fs.writeFile(join(root, 'notes.txt'), 'ignore');

    const dirs = await listVersionDirs(root);
    expect(dirs).to.deep.equal(['000', '002', '010']);
  });

  it('enumerateStepVersions should return all versions where from < k <= to', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    await fs.mkdir(join(root, '000'));
    await fs.mkdir(join(root, '001'));
    await fs.mkdir(join(root, '002'));
    await fs.mkdir(join(root, '010'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };

    const steps = await enumerateStepVersions('001', '010', cfg);
    expect(steps).to.deep.equal(['002', '010']);

    await expect(enumerateStepVersions('010', '001', cfg)).rejects.toThrow(
      /must be greater/,
    );
  });
});
