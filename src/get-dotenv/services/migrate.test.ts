import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import { describe, expect, it, vi } from 'vitest';

import type { EntityClient } from '../../EntityClient/EntityClient';
import { enumerateStepVersions, type VersionedLayoutConfig } from '../layout';
import { migrateData } from './migrate';

const jsModule = (body: string) =>
  `module.exports = ${body};\nmodule.exports.default = module.exports;`;

// Minimal EM module body with removeKeys/addKeys and hash config.
const emBody = `() => ({
  config: {
    hashKey: 'hashKey2',
    rangeKey: 'rangeKey',
    shardKeyDelimiter: '!',
    generatedProperties: { sharded: {}, unsharded: {} },
    indexes: {},
    propertyTranscodes: {}
  },
  removeKeys: (_et, rec) => {
    const { hashKey2, rangeKey, ...rest } = rec || {};
    return rest;
  },
  addKeys: (et, item) => ({ ...item, hashKey2: et + '!x', rangeKey: 'rk' })
})`;

// Write an EM (and optional transform) for a version dir.
async function writeVersion(
  root: string,
  version: string,
  transformBody?: string,
) {
  const dir = join(root, version);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, 'entityManager.js'), jsModule(emBody), 'utf8');
  if (transformBody) {
    await fs.writeFile(
      join(dir, 'transform.js'),
      jsModule(transformBody),
      'utf8',
    );
  }
}

function makeClients(items: Record<string, unknown>[]): {
  source: EntityClient<BaseConfigMap>;
  target: EntityClient<BaseConfigMap> & {
    _putBatches: Record<string, unknown>[][];
  };
} {
  let scanned = false;
  const source = {
    tableName: 'Source',
    doc: {
      scan: vi.fn(async (_input: unknown) => {
        // satisfy require-await
        await Promise.resolve();
        if (scanned) return { Items: [], LastEvaluatedKey: undefined };
        scanned = true;
        return { Items: items, LastEvaluatedKey: undefined };
      }),
    },
  } as unknown as EntityClient<BaseConfigMap>;

  const batches: Record<string, unknown>[][] = [];
  const target = {
    tableName: 'Target',
    putItems: vi.fn(async (recs: Record<string, unknown>[]) => {
      await Promise.resolve();
      batches.push(recs);
      // Return shape not asserted by service; stub minimal.
      return [] as never;
    }),
    _putBatches: batches,
  } as unknown as EntityClient<BaseConfigMap> & {
    _putBatches: Record<string, unknown>[][];
  };

  return { source, target };
}

describe('get-dotenv migrateData service', function () {
  it('default chain: prev.removeKeys -> next.addKeys (no transform)', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'migrate-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    // From 000 to 001, only EMs, no transform
    await writeVersion(root, '000');
    await writeVersion(root, '001');
    // Ensure enumerateStepVersions sees both
    const steps = await enumerateStepVersions('000', '001', cfg);
    expect(steps).to.deep.equal(['001']);

    // Build source items (storage records with hashKey2 carrying entity prefix).
    const srcItems = [
      { hashKey2: 'user!a', rangeKey: 'r1', a: 1 },
      { hashKey2: 'user!b', rangeKey: 'r2', a: 2 },
    ];
    const { source, target } = makeClients(srcItems);

    const out = await migrateData(source, target, {
      fromVersion: '000',
      toVersion: '001',
      cfg,
      pageSize: 25,
    });

    expect(out.pages).to.equal(1);
    expect(out.items).to.equal(2);
    expect(out.outputs).to.equal(2);
    // One batch written with 2 items
    expect(target._putBatches.length).to.equal(1);
    expect(target._putBatches[0].length).to.equal(2);
  });

  it('transform: drop via undefined (no outputs)', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'migrate-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await writeVersion(root, '000');
    // transform returns undefined => drop
    const transform = `({ user: async () => undefined })`;
    await writeVersion(root, '001', transform);

    const srcItems = [
      { hashKey2: 'user!a', rangeKey: 'r1', a: 1 },
      { hashKey2: 'user!b', rangeKey: 'r2', a: 2 },
    ];
    const { source, target } = makeClients(srcItems);

    const out = await migrateData(source, target, {
      fromVersion: '000',
      toVersion: '001',
      cfg,
      pageSize: 25,
    });

    expect(out.outputs).to.equal(0);
    expect(target._putBatches.length).to.equal(0);
  });

  it('transform: fan-out by returning an array of items', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'migrate-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await writeVersion(root, '000');
    // return array of items (domain items); service will addKeys against next
    const transform = `({ 
      user: async (record, { prev }) => {
        const item = prev.removeKeys('user', record);
        return [ { ...item, x: 1 }, { ...item, x: 2 } ];
      } 
    })`;
    await writeVersion(root, '001', transform);

    const srcItems = [{ hashKey2: 'user!a', rangeKey: 'r1', a: 1 }];
    const { source, target } = makeClients(srcItems);

    const out = await migrateData(source, target, {
      fromVersion: '000',
      toVersion: '001',
      cfg,
      pageSize: 25,
    });

    expect(out.outputs).to.equal(2);
    expect(target._putBatches.length).to.equal(1);
    expect(target._putBatches[0].length).to.equal(2);
  });
});
