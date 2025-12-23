import type { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';
import {
  findSubcommand,
  hasLongOption,
  makeInstalledCli,
} from './commandTestUtils';

describe('dynamodb plugin: local command registration', () => {
  it('registers dynamodb local start|status|stop commands', async () => {
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

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
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const local = findSubcommand(dynamodb, 'local');
    const start = findSubcommand(local, 'start');
    const status = findSubcommand(local, 'status');

    expect(hasLongOption(start, '--port')).toBe(true);
    expect(hasLongOption(status, '--port')).toBe(true);
  });
});
