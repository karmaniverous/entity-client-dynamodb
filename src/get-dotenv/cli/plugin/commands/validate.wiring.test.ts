import type { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';
import {
  findSubcommand,
  hasLongOption,
  makeInstalledCli,
} from './commandTestUtils';

describe('dynamodb plugin: validate command registration', () => {
  it('registers dynamodb validate and key options', async () => {
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const validate = findSubcommand(dynamodb, 'validate');

    expect(hasLongOption(validate, '--version')).toBe(true);
    expect(hasLongOption(validate, '--tables-path')).toBe(true);
    expect(hasLongOption(validate, '--token-table')).toBe(true);
    expect(hasLongOption(validate, '--token-entity-manager')).toBe(true);
    expect(hasLongOption(validate, '--token-transform')).toBe(true);
  });
});
