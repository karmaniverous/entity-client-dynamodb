/** Verify optional-peer and external-dependency boundaries in build output. */
import { readFile } from 'node:fs/promises';

const rootTypes = await readFile(
  new URL('../dist/index.d.ts', import.meta.url),
  'utf8',
);
if (rootTypes.includes('@karmaniverous/get-dotenv')) {
  throw new Error('main-entry declarations reference optional get-dotenv peer');
}

const schemaModule = await readFile(
  new URL('../dist/mjs/get-dotenv/cli/options/schema.js', import.meta.url),
  'utf8',
);
if (!/from ['"]zod['"]/.test(schemaModule)) {
  throw new Error('get-dotenv schema output does not keep zod external');
}
