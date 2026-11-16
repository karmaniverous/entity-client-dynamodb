import { readFile } from 'node:fs/promises';

interface PackageJson {
  name: string;
  'release-it': {
    git: { changelog: string };
    github: { release: boolean; releaseName?: string; releaseNotes?: string };
    hooks: { 'after:bump': string[] };
  };
}

async function readPackageJson(): Promise<PackageJson> {
  const raw = await readFile(
    new URL('../package.json', import.meta.url),
    'utf8',
  );
  return JSON.parse(raw) as PackageJson;
}

describe('release-it configuration', () => {
  it('names GitHub releases after the unscoped package and version', async () => {
    const pkg = await readPackageJson();

    expect(pkg['release-it'].github).toMatchObject({
      release: true,
      releaseName: "${name.split('/').pop()}@${version}",
    });
  });

  it('generates release notes before writing and staging the changelog', async () => {
    const pkg = await readPackageJson();
    const release = pkg['release-it'];

    expect(release.git.changelog).toContain('--unreleased');
    expect(release.github.releaseNotes).toBe(release.git.changelog);
    expect(release.hooks['after:bump']).toEqual([
      'npx auto-changelog -p',
      'npm run docs',
      'git add CHANGELOG.md',
    ]);
  });
});
