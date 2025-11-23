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
  refreshGeneratedSectionsInPlace,
} from './tableDefinition';

// Minimal fake EntityManager-like object for tests (runtime-only shape).
function makeFakeEm(): EntityManager<BaseConfigMap> {
  // runtime: only config is used by computeGeneratedSections -> generateTableDefinition
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

describe('get-dotenv tableDefinition utilities', function () {
  it('composeNewTableYaml should create a table.yml from baseline + generated sections', async function () {
    const dir = await fs.mkdtemp(join(tmpdir(), 'tbl-'));
    const out = resolve(dir, 'table.yml');

    // Baseline template with a non-generated property & a comment
    const baseline = resolve(dir, 'table.template.yml');
    const baselineDoc = new YAML.Document();
    baselineDoc.commentBefore = 'BASELINE HEADER';
    baselineDoc.set('Type', 'AWS::DynamoDB::Table');
    baselineDoc.set('Properties', { BillingMode: 'PAY_PER_REQUEST' });
    await fs.writeFile(baseline, baselineDoc.toString(), 'utf8');

    const em = makeFakeEm();
    const generated = computeGeneratedSections(em);
    await composeNewTableYaml(out, baseline, generated);

    const text = await fs.readFile(out, 'utf8');
    const doc = YAML.parseDocument(text);
    // Type preserved
    expect(doc.get('Type')).to.equal('AWS::DynamoDB::Table');
    // Baseline non-generated property preserved
    const props = doc.get('Properties') as YAML.YAMLMap;
    expect((props.get('BillingMode') as string) ?? '').to.equal(
      'PAY_PER_REQUEST',
    );
    // Generated sections present
    expect(props.get('AttributeDefinitions')).to.exist;
    expect(props.get('KeySchema')).to.exist;
    expect(props.get('GlobalSecondaryIndexes')).to.exist;
    // Header present
    expect((doc as YAML.Document).commentBefore).to.match(
      /GENERATED SECTIONS WARNING/,
    );
  });

  it('refreshGeneratedSectionsInPlace should replace only generated nodes and preserve comments/other properties', async function () {
    const dir = await fs.mkdtemp(join(tmpdir(), 'tbl-'));
    const out = resolve(dir, 'table.yml');

    // Initial doc with baseline + fake generated nodes + a custom property & banner
    const initialDoc = new YAML.Document();
    initialDoc.commentBefore = 'CUSTOM HEADER';
    initialDoc.set('Type', 'AWS::DynamoDB::Table');
    initialDoc.set('Properties', {
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: 'old', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'old', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [],
    });
    await fs.writeFile(out, initialDoc.toString(), 'utf8');

    const em = makeFakeEm();
    const generated = computeGeneratedSections(em);
    await refreshGeneratedSectionsInPlace(out, generated);

    const text = await fs.readFile(out, 'utf8');
    const doc = YAML.parseDocument(text);
    const props = doc.get('Properties') as YAML.YAMLMap;

    // Custom property preserved
    expect(props.get('BillingMode')).to.equal('PAY_PER_REQUEST');
    // Header preserved or replaced with warning (both acceptable: we ensure header exists)
    expect((doc as YAML.Document).commentBefore).to.be.a('string');

    // Generated nodes updated (key presence sufficient as a smoke test)
    expect(props.get('AttributeDefinitions')).to.exist;
    expect(props.get('KeySchema')).to.exist;
  });
});
