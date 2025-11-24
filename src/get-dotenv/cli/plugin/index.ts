import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';

import { registerCreate } from './commands/create';
import { registerDelete } from './commands/delete';
import { registerGenerate } from './commands/generate';
import { registerMigrate } from './commands/migrate';
import { registerPurge } from './commands/purge';
import { registerValidate } from './commands/validate';

export const dynamodbPlugin = definePlugin({
  id: 'dynamodb',
  setup: (cli) => {
    const group = cli
      .ns('dynamodb')
      .description(
        'DynamoDB utilities (versioned table defs, lifecycle, migration)',
      );

    registerGenerate(cli, group);
    registerValidate(cli, group);
    registerCreate(cli, group);
    registerDelete(cli, group);
    registerPurge(cli, group);
    registerMigrate(cli, group);
  },
});
