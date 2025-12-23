import type { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';
import {
  findSubcommand,
  hasLongOption,
  makeInstalledCli,
} from './commandTestUtils';

describe('dynamodb plugin: delete command registration', () => {
  it('registers dynamodb delete and key options', async () => {
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const del = findSubcommand(dynamodb, 'delete');

    expect(hasLongOption(del, '--table-name')).toBe(true);
    expect(hasLongOption(del, '--version')).toBe(true);
    expect(hasLongOption(del, '--max-seconds')).toBe(true);
    expect(hasLongOption(del, '--force')).toBe(true);
  });
});
