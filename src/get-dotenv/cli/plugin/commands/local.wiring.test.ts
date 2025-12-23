import type { Command } from '@commander-js/extra-typings';
import { GetDotenvCli } from '@karmaniverous/get-dotenv/cliHost';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';

async function makeInstalledCli(): Promise<GetDotenvCli> {
  const cli = new GetDotenvCli('testcli');
  cli.attachRootOptions({ loadProcess: false, log: false });
  cli.use(dynamodbPlugin());
  await cli.install();
  return cli;
}

function findSubcommand(parent: Command, name: string): Command {
  const cmd = parent.commands.find((c) => c.name() === name);
  if (!cmd) throw new Error(`missing subcommand: ${name}`);
  return cmd as Command;
}

function hasLongOption(cmd: Command, long: string): boolean {
  return cmd.options.some((o) => o.long === long);
}

describe('dynamodb plugin: local command registration', () => {
  it('registers dynamodb local start|status|stop commands', async () => {
    const cli = await makeInstalledCli();

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const local = findSubcommand(dynamodb, 'local');
    const start = findSubcommand(local, 'start');
    const status = findSubcommand(local, 'status');
    const stop = findSubcommand(local, 'stop');

    expect(start.name()).toBe('start');
    expect(status.name()).toBe('status');
    expect(stop.name()).toBe('stop');
  });

  it('exposes --port on local start and local status', async () => {
    const cli = await makeInstalledCli();

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const local = findSubcommand(dynamodb, 'local');
    const start = findSubcommand(local, 'start');
    const status = findSubcommand(local, 'status');

    expect(hasLongOption(start, '--port')).toBe(true);
    expect(hasLongOption(status, '--port')).toBe(true);
  });
});
