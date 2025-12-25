import type { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';
import {
  findSubcommand,
  hasLongOption,
  makeInstalledCli,
} from './commandTestUtils';

describe('dynamodb plugin: generate command registration', () => {
  it('registers dynamodb generate and key options', async () => {
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const gen = findSubcommand(dynamodb, 'generate');

    expect(hasLongOption(gen, '--version')).toBe(true);
    expect(hasLongOption(gen, '--tables-path')).toBe(true);
    expect(hasLongOption(gen, '--clean')).toBe(true);
    expect(hasLongOption(gen, '--table-billing-mode')).toBe(true);
    expect(hasLongOption(gen, '--table-rcu')).toBe(true);
    expect(hasLongOption(gen, '--table-wcu')).toBe(true);
    expect(hasLongOption(gen, '--table-name')).toBe(true);
  });
});
