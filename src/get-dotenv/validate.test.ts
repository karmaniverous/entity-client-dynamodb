import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import {
  composeNewTableYaml,
  computeGeneratedSections,
} from './tableDefinition';
import { validateGeneratedSections } from './validate';

function makeFakeEm(): EntityManager<BaseConfigMap> {
  const em = {
    config: {
      generatedProperties: { sharded: {}, unsharded: {} },
      hashKey: 'hashKey',
      rangeKey: 'rangeKey',
      indexes: {
        created: { hashKey: 'hashKey', rangeKey: 'created' },
      },
      propertyTranscodes: {
        hashKey: 'string',
        rangeKey: 'string',
        created: 'timestamp',
      },
    },
  } as unknown as EntityManager<BaseConfigMap>;
  return em;
}

describe('get-dotenv validate generated sections', function () {
  it('should return equal=true when YAML matches EM output', async function () {
    const dir = await fs.mkdtemp(join(tmpdir(), 'val-'));
    const out = resolve(dir, 'table.yml');

    const em = makeFakeEm();
    const generated = computeGeneratedSections(em);
    await composeNewTableYaml(out, undefined, generated);

    const result = await validateGeneratedSections(out, em);
    expect(result.equal).to.equal(true);
    expect(result.diffs).to.deep.equal([]);
  });

  it('should return equal=false and diffs when YAML is edited', async function () {
    const dir = await fs.mkdtemp(join(tmpdir(), 'val-'));
    const out = resolve(dir, 'table.yml');

    const em = makeFakeEm();
    const generated = computeGeneratedSections(em);
    await composeNewTableYaml(out, undefined, generated);

    // Edit a generated key to force drift
    const text = await fs.readFile(out, 'utf8');
    const doc = YAML.parseDocument(text);
    const props = doc.get('Properties') as YAML.YAMLMap;
    props.set('KeySchema', [
      { AttributeName: 'something_else', KeyType: 'HASH' },
    ]);
    await fs.writeFile(out, doc.toString(), 'utf8');

    const result = await validateGeneratedSections(out, em);
    expect(result.equal).to.equal(false);
    expect(result.diffs.length).to.be.greaterThan(0);
  });

  it('should produce path-level granularity for a single changed field', async function () {
    const dir = await fs.mkdtemp(join(tmpdir(), 'val-'));
    const out = resolve(dir, 'table.yml');

    const em = makeFakeEm();
    const generated = computeGeneratedSections(em);
    await composeNewTableYaml(out, undefined, generated);

    // Change one AttributeType to trigger a targeted CHANGE diff
    const text = await fs.readFile(out, 'utf8');
    const doc = YAML.parseDocument(text);
    const props = doc.get('Properties') as YAML.YAMLMap;
    const attrDefs = props.get('AttributeDefinitions') as YAML.YAMLSeq;

    // Find 'created' (AttributeType: N) and change to 'S' so EM expects N but YAML has S
    for (const item of attrDefs.items) {
      if (YAML.isMap(item) && item.get('AttributeType') === 'N') {
        item.set('AttributeType', 'S');
        break;
      }
    }
    await fs.writeFile(out, doc.toString(), 'utf8');

    const result = await validateGeneratedSections(out, em);
    expect(result.equal).to.equal(false);

    // Diff must include at least one CHANGE with a multi-segment path
    const changeDiff = result.diffs.find((d) => d.type === 'CHANGE');
    expect(changeDiff).toBeDefined();
    expect(changeDiff?.path.length).toBeGreaterThan(1);
    expect(changeDiff?.path[0]).toBe('AttributeDefinitions');
  });

  it('should include both value and oldValue on CHANGE diffs', async function () {
    const dir = await fs.mkdtemp(join(tmpdir(), 'val-'));
    const out = resolve(dir, 'table.yml');

    const em = makeFakeEm();
    const generated = computeGeneratedSections(em);
    await composeNewTableYaml(out, undefined, generated);

    // Same edit: change 'created' AttributeType from N to S
    const text = await fs.readFile(out, 'utf8');
    const doc = YAML.parseDocument(text);
    const props = doc.get('Properties') as YAML.YAMLMap;
    const attrDefs = props.get('AttributeDefinitions') as YAML.YAMLSeq;

    for (const item of attrDefs.items) {
      if (YAML.isMap(item) && item.get('AttributeType') === 'N') {
        item.set('AttributeType', 'S');
        break;
      }
    }
    await fs.writeFile(out, doc.toString(), 'utf8');

    const result = await validateGeneratedSections(out, em);
    const changeDiff = result.diffs.find((d) => d.type === 'CHANGE');
    expect(changeDiff).toBeDefined();
    expect(changeDiff?.value).toBeDefined();
    expect(changeDiff?.oldValue).toBeDefined();
    expect(changeDiff?.value).not.toEqual(changeDiff?.oldValue);
  });
});
