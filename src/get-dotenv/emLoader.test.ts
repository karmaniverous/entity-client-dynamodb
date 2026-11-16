import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  commonJsDefault,
  entityManagerFactory,
} from '../../test/entityManagerModule';
import { resolveAndLoadEntityManager } from './emLoader';
import type { VersionedLayoutConfig } from './layout';

const validEntityManagerFactory = entityManagerFactory(`{
  entities: {},
  generatedProperties: { sharded: {}, unsharded: {} },
  hashKey: 'hashKey',
  indexes: {},
  propertyTranscodes: {},
  rangeKey: 'rangeKey',
  transcodes: {},
}`);

describe('get-dotenv EM loader', function () {
  it('should load EM from current version when present', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '001'), { recursive: true });

    const emPath = join(root, '001', 'entityManager.js');
    await fs.writeFile(
      emPath,
      commonJsDefault(validEntityManagerFactory),
      'utf8',
    );

    const em = await resolveAndLoadEntityManager('001', cfg);
    expect(em).to.have.property('config');
  });

  it('should fall back to earlier version when current has no EM', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '000'), { recursive: true });
    await fs.mkdir(join(root, '005'), { recursive: true });

    const emPath = join(root, '000', 'entityManager.js');
    await fs.writeFile(
      emPath,
      commonJsDefault(validEntityManagerFactory),
      'utf8',
    );

    const em = await resolveAndLoadEntityManager('005', cfg);
    expect(em).to.have.property('config');
  });

  it('rejects a structural lookalike that is not an EntityManager', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '001'), { recursive: true });
    await fs.writeFile(
      join(root, '001', 'entityManager.js'),
      commonJsDefault(`() => ({ config: {} })`),
      'utf8',
    );

    await expect(resolveAndLoadEntityManager('001', cfg)).rejects.toThrow(
      /invalid EntityManager module export/,
    );
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
