const constructorArgs = vi.hoisted(
  () => [] as [string, { importMetaUrl: string }][],
);

vi.mock('@karmaniverous/get-dotenv/cliHost', () => ({
  GetDotenvCli: class {
    constructor(alias: string, options: { importMetaUrl: string }) {
      constructorArgs.push([alias, options]);
    }

    attachRootOptions(): void {
      return undefined;
    }

    install(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

import { makeInstalledCli } from './commandTestUtils';

describe('makeInstalledCli', () => {
  it('identifies this package as the get-dotenv host', async () => {
    await makeInstalledCli(() => undefined);

    expect(constructorArgs).toHaveLength(1);
    const [alias, options] = constructorArgs[0];
    expect(alias).toBe('testcli');
    expect(options.importMetaUrl).toContain('commandTestUtils');
  });
});
