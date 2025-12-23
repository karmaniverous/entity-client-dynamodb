import type { Command } from '@commander-js/extra-typings';
import { GetDotenvCli } from '@karmaniverous/get-dotenv/cliHost';

export async function makeInstalledCli(
  install: (cli: GetDotenvCli) => void,
): Promise<GetDotenvCli> {
  const cli = new GetDotenvCli('testcli');
  cli.attachRootOptions({ loadProcess: false, log: false });
  install(cli);
  await cli.install();
  return cli;
}

export function findSubcommand(parent: Command, name: string): Command {
  const cmd = parent.commands.find((c) => c.name() === name);
  if (!cmd) throw new Error(`missing subcommand: ${name}`);
  return cmd as Command;
}

export function hasLongOption(cmd: Command, long: string): boolean {
  return cmd.options.some((o) => o.long === long);
}
