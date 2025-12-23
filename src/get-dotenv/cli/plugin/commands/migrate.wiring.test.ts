import type { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { dynamodbPlugin } from '../index';
import {
  findSubcommand,
  hasLongOption,
  makeInstalledCli,
} from './commandTestUtils';

describe('dynamodb plugin: migrate command registration', () => {
  it('registers dynamodb migrate and key options', async () => {
    const cli = await makeInstalledCli((c) => c.use(dynamodbPlugin()));

    const dynamodb = findSubcommand(cli as unknown as Command, 'dynamodb');
    const migrate = findSubcommand(dynamodb, 'migrate');

    expect(hasLongOption(migrate, '--source-table')).toBe(true);
    expect(hasLongOption(migrate, '--target-table')).toBe(true);
    expect(hasLongOption(migrate, '--from-version')).toBe(true);
    expect(hasLongOption(migrate, '--to-version')).toBe(true);
    expect(hasLongOption(migrate, '--page-size')).toBe(true);
    expect(hasLongOption(migrate, '--limit')).toBe(true);
    expect(hasLongOption(migrate, '--transform-concurrency')).toBe(true);
    expect(hasLongOption(migrate, '--progress-interval-ms')).toBe(true);
    expect(hasLongOption(migrate, '--force')).toBe(true);
  });
});
