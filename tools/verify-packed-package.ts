/**
 * Verify the packed package in an isolated consumer without the optional
 * get-dotenv peer. Supports runtime and strict TypeScript checks.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is required');

const mode = process.argv[2];
if (mode !== 'runtime' && mode !== 'types') {
  throw new Error('usage: verify-packed-package.ts <runtime|types>');
}

const root = resolve(import.meta.dirname, '..');
const fixture = mkdtempSync(join(tmpdir(), `entity-client-dynamodb-${mode}-`));

function run(command: string, args: string[], cwd = fixture): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

try {
  const packJson = run(
    process.execPath,
    [npmCli, 'pack', '--json', '--pack-destination', fixture],
    root,
  );
  const packed = JSON.parse(packJson) as Array<{ filename: string }>;
  const filename = packed[0]?.filename;
  if (!filename) throw new Error('npm pack did not report a tarball');

  const tarball = join(fixture, filename);
  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  run(process.execPath, [
    npmCli,
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--no-package-lock',
    tarball,
  ]);

  const optionalPeerPath = join(
    fixture,
    'node_modules',
    '@karmaniverous',
    'get-dotenv',
  );
  if (existsSync(join(optionalPeerPath, 'package.json'))) {
    throw new Error('optional get-dotenv peer was installed in the fixture');
  }

  if (mode === 'runtime') {
    run('node', [
      '--input-type=module',
      '--eval',
      "await import('@karmaniverous/entity-client-dynamodb');",
    ]);
  } else {
    run(process.execPath, [
      npmCli,
      'install',
      '--save-dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '@types/node@26.6.6',
      'typescript@6.0.3',
    ]);
    writeFileSync(
      join(fixture, 'index.ts'),
      [
        "import type { IndexParams, ProcessEnv } from '@karmaniverous/entity-client-dynamodb';",
        "const names: ProcessEnv = { '#pk': 'pk', OPTIONAL: undefined };",
        'const params: IndexParams = {',
        '  expressionAttributeNames: names,',
        '  expressionAttributeValues: {},',
        '  filterConditions: [],',
        '};',
        'void params;',
      ].join('\n'),
    );
    writeFileSync(
      join(fixture, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: 'ES2022',
          types: ['node'],
        },
        include: ['index.ts'],
      }),
    );
    run(process.execPath, [
      join(fixture, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--project',
      'tsconfig.json',
    ]);
  }
} finally {
  rmSync(fixture, { force: true, recursive: true });
}
