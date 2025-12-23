import { definePlugin } from '@karmaniverous/get-dotenv/cliHost';

import { DynamodbPluginConfigSchema } from '../options/schema';
import { registerCreate } from './commands/create';
import { registerDelete } from './commands/delete';
import { registerGenerate } from './commands/generate';
import { registerLocal } from './commands/local';
import { registerMigrate } from './commands/migrate';
import { registerPurge } from './commands/purge';
import { registerValidate } from './commands/validate';

export const dynamodbPlugin = () => {
  const plugin = definePlugin({
    ns: 'dynamodb',
    configSchema: DynamodbPluginConfigSchema,
    setup: (cli) => {
      cli.description(
        'DynamoDB utilities (versioned table defs, lifecycle, migration)',
      );

      registerGenerate(plugin, cli, cli);
      registerValidate(plugin, cli, cli);
      registerCreate(plugin, cli, cli);
      registerDelete(plugin, cli, cli);
      registerPurge(plugin, cli, cli);
      registerMigrate(plugin, cli, cli);
      registerLocal(plugin, cli, cli);
    },
  });

  return plugin;
};
