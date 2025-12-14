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
      const group = cli
        .ns('dynamodb')
        .description(
          'DynamoDB utilities (versioned table defs, lifecycle, migration)',
        );

      registerGenerate(plugin, cli, group);
      registerValidate(plugin, cli, group);
      registerCreate(plugin, cli, group);
      registerDelete(plugin, cli, group);
      registerPurge(plugin, cli, group);
      registerMigrate(plugin, cli, group);
      registerLocal(plugin, cli, group);
    },
  });

  return plugin;
};
