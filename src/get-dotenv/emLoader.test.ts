import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EntityManager } from '@karmaniverous/entity-manager';
import { describe, expect, it } from 'vitest';

import {
  commonJsDefault,
  entityManagerFactory,
  entityManagerInstance,
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

const validParsedConfig: Record<string, unknown> = {
  entities: {},
  generatedProperties: { sharded: {}, unsharded: {} },
  hashKey: 'hashKey',
  indexes: {},
  generatedKeyDelimiter: '|',
  generatedValueDelimiter: '#',
  propertyTranscodes: {},
  rangeKey: 'rangeKey',
  shardKeyDelimiter: '!',
  throttle: 10,
  transcodes: {},
};

const entityManagerLookalike = (configSource: string): string => `() => ({
  config: ${configSource},
  logger: { debug() {}, error() {} },
  addKeys() {},
  encodeGeneratedProperty() {},
  findIndexToken() {},
  getPrimaryKey() {},
  query() {},
  removeKeys() {},
})`;

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

  it('loads a direct instance from a separate EntityManager module copy', async () => {
    const sandbox = await fs.mkdtemp(join(process.cwd(), '.em-loader-'));
    try {
      const packageRoot = new URL(
        '../../',
        import.meta.resolve('@karmaniverous/entity-manager'),
      );
      await fs.cp(
        packageRoot,
        join(sandbox, 'node_modules', '@karmaniverous', 'entity-manager'),
        { recursive: true },
      );

      const root = join(sandbox, 'tables');
      const cfg: VersionedLayoutConfig = { tablesPath: root };
      const versionDir = join(root, '001');
      await fs.mkdir(versionDir, { recursive: true });
      await fs.writeFile(
        join(versionDir, 'package.json'),
        JSON.stringify({ type: 'module' }),
        'utf8',
      );
      await fs.writeFile(
        join(versionDir, 'entityManager.js'),
        entityManagerInstance(
          `{
            entities: {},
            generatedProperties: { sharded: {}, unsharded: {} },
            hashKey: 'hashKey',
            indexes: {},
            propertyTranscodes: {},
            rangeKey: 'rangeKey',
            transcodes: {},
          }`,
          '@karmaniverous/entity-manager',
        ),
        'utf8',
      );

      const em = await resolveAndLoadEntityManager('001', cfg);
      expect(em).not.toBeInstanceOf(EntityManager);
      expect(em.config.hashKey).toBe('hashKey');
    } finally {
      await fs.rm(sandbox, { recursive: true, force: true });
    }
  });

  it('rejects each invalid field on a capability-complete lookalike', async () => {
    const cases: readonly (readonly [
      string,
      (config: Record<string, unknown>) => void,
      configSource?: string,
    ])[] = [
      ['entities', (config) => (config.entities = null)],
      ['generatedProperties', (config) => (config.generatedProperties = null)],
      [
        'generatedProperties.sharded',
        (config) =>
          ((config.generatedProperties as Record<string, unknown>).sharded =
            null),
      ],
      [
        'generatedProperties.unsharded',
        (config) =>
          ((config.generatedProperties as Record<string, unknown>).unsharded =
            null),
      ],
      ['hashKey', (config) => (config.hashKey = null)],
      ['indexes', (config) => (config.indexes = null)],
      [
        'generatedKeyDelimiter',
        (config) => (config.generatedKeyDelimiter = null),
      ],
      [
        'generatedValueDelimiter',
        (config) => (config.generatedValueDelimiter = null),
      ],
      ['propertyTranscodes', (config) => (config.propertyTranscodes = null)],
      ['rangeKey', (config) => (config.rangeKey = null)],
      ['shardKeyDelimiter', (config) => (config.shardKeyDelimiter = null)],
      ['throttle type', (config) => (config.throttle = 'invalid')],
      [
        'finite throttle',
        () => undefined,
        JSON.stringify(validParsedConfig).replace(
          '"throttle":10',
          '"throttle":Infinity',
        ),
      ],
      ['transcodes', (config) => (config.transcodes = null)],
    ];

    for (const [label, mutate, explicitConfigSource] of cases) {
      const root = await fs.mkdtemp(join(tmpdir(), 'tables-'));
      const cfg: VersionedLayoutConfig = { tablesPath: root };
      await fs.mkdir(join(root, '001'), { recursive: true });
      const config = structuredClone(validParsedConfig);
      mutate(config);
      const configSource = explicitConfigSource ?? JSON.stringify(config);
      await fs.writeFile(
        join(root, '001', 'entityManager.js'),
        commonJsDefault(entityManagerLookalike(configSource)),
        'utf8',
      );

      await expect(
        resolveAndLoadEntityManager('001', cfg),
        label,
      ).rejects.toThrow(/invalid EntityManager module export/);
    }
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
