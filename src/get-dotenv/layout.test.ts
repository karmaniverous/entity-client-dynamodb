import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  enumerateStepVersions,
  listVersionDirs,
  parseVersionValue,
  type VersionedLayoutConfig,
} from './layout';

describe('get-dotenv layout helpers', function () {
  it('parseVersionValue should accept numeric tokens (padding ignored)', function () {
    expect(parseVersionValue('003')).to.equal(3);
    expect(parseVersionValue('3')).to.equal(3);
    expect(() => parseVersionValue('a03')).to.throw(/invalid version token/);
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

  it('listVersionDirs should error on duplicate numeric values (e.g., 1 and 001)', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    await fs.mkdir(join(root, '1'));
    await fs.mkdir(join(root, '001'));
    await expect(listVersionDirs(root)).rejects.toThrow(
      /duplicate version directories/,
    );
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
