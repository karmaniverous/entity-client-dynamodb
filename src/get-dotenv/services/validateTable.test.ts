import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { resolveAndLoadEntityManager } from '../emLoader';
import { type VersionedLayoutConfig } from '../layout';
import {
  composeNewTableYaml,
  computeGeneratedSections,
} from '../tableDefinition';
import { validateTableDefinitionAtVersion } from './validateTable';

const jsModule = (body: string) =>
  `module.exports = ${body};\nmodule.exports.default = module.exports;`;

describe('get-dotenv validateTableDefinitionAtVersion service', function () {
  it('validates a matching YAML (equal=true)', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'valsvc-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '001'), { recursive: true });

    // Minimal EM for tests (runtime-only shape expected by computeGeneratedSections)
    const emPath = join(root, '001', 'entityManager.js');
    const emBody = `() => ({
      config: {
        generatedProperties: { sharded: {}, unsharded: {} },
        hashKey: 'hashKey',
        rangeKey: 'rangeKey',
        indexes: { created: { hashKey: 'hashKey', rangeKey: 'created' } },
        propertyTranscodes: { hashKey: 'string', rangeKey: 'string', created: 'timestamp' }
      }
    })`;
    await fs.writeFile(emPath, jsModule(emBody), 'utf8');

    // Compose a matching table.yml for version 001
    const em = await resolveAndLoadEntityManager('001', cfg);
    const generated = computeGeneratedSections(em);
    const out = resolve(root, '001', 'table.yml');
    await composeNewTableYaml(out, undefined, generated);

    const result = await validateTableDefinitionAtVersion('001', cfg);
    const normalized = result.tablePath.split('\\').join('/');
    expect(normalized.endsWith('/001/table.yml')).to.equal(true);
    expect(result.equal).to.equal(true);
    expect(result.diffs).to.deep.equal([]);
  });

  it('detects drift (equal=false, diffs populated)', async function () {
    const root = await fs.mkdtemp(join(tmpdir(), 'valsvc-'));
    const cfg: VersionedLayoutConfig = { tablesPath: root };
    await fs.mkdir(join(root, '001'), { recursive: true });

    const emPath = join(root, '001', 'entityManager.js');
    const emBody = `() => ({
      config: {
        generatedProperties: { sharded: {}, unsharded: {} },
        hashKey: 'hashKey',
        rangeKey: 'rangeKey',
        indexes: { created: { hashKey: 'hashKey', rangeKey: 'created' } },
        propertyTranscodes: { hashKey: 'string', rangeKey: 'string', created: 'timestamp' }
      }
    })`;
    await fs.writeFile(emPath, jsModule(emBody), 'utf8');

    const em = await resolveAndLoadEntityManager('001', cfg);
    const generated = computeGeneratedSections(em);
    const out = resolve(root, '001', 'table.yml');
    await composeNewTableYaml(out, undefined, generated);

    // Introduce drift in KeySchema
    const text = await fs.readFile(out, 'utf8');
    const doc = YAML.parseDocument(text);
    const props = doc.get('Properties') as YAML.YAMLMap;
    props.set('KeySchema', [
      { AttributeName: 'something_else', KeyType: 'HASH' },
    ]);
    await fs.writeFile(out, doc.toString(), 'utf8');

    const result = await validateTableDefinitionAtVersion('001', cfg);
    expect(result.equal).to.equal(false);
    expect(result.diffs.length).to.be.greaterThan(0);
  });
});
