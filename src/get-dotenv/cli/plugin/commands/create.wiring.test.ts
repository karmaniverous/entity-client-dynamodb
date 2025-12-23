import type { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';
import {
  findSubcommand,
  hasLongOption,
  makeInstalledCli,
} from './commandTestUtils';

describe('dynamodb plugin: create command registration', () => {
  it('registers dynamodb create and key options', async () => {
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const create = findSubcommand(dynamodb, 'create');

    expect(hasLongOption(create, '--version')).toBe(true);
    expect(hasLongOption(create, '--tables-path')).toBe(true);
    expect(hasLongOption(create, '--max-seconds')).toBe(true);
    expect(hasLongOption(create, '--table-name-override')).toBe(true);
    expect(hasLongOption(create, '--refresh-generated')).toBe(true);
    expect(hasLongOption(create, '--force')).toBe(true);
  });
});
