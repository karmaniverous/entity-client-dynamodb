import type { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';
import {
  findSubcommand,
  hasLongOption,
  makeInstalledCli,
} from './commandTestUtils';

describe('dynamodb plugin: purge command registration', () => {
  it('registers dynamodb purge and key options', async () => {
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const purge = findSubcommand(dynamodb, 'purge');

    expect(hasLongOption(purge, '--table-name')).toBe(true);
    expect(hasLongOption(purge, '--version')).toBe(true);
    expect(hasLongOption(purge, '--force')).toBe(true);
  });
});
