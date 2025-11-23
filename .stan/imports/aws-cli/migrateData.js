/*
******************* DO NOT EDIT THIS NOTICE *****************
This code and all related intellectual property is owned by  
Veteran Crowd Rewards, LLC. It is not to be disclosed, copied
or used without written permission.                          
*************************************************************
*/

// npm imports
import { WrappedDynamoDbClient } from '@veterancrowd/wrapped-dynamodb-client';
import {
  dotenvExpand,
  getDotenvCliOptions2Options,
} from '@karmaniverous/get-dotenv';
import confirm from '@inquirer/confirm';
import { Command } from 'commander';
import fs from 'fs-extra';
import _ from 'lodash';
import { packageDirectory } from 'pkg-dir';
import { resolve } from 'path';
import url from 'url';

export const migrateData = new Command()
  .name('migrate-data')
  .description('Migrate data from one DynamoDB table to another.')
  .enablePositionalOptions()
  .passThroughOptions()
  .option(
    '-s, --source-table <string>',
    'Source DynamoDB table name (prefix with $ to use env var)',
    '$LAST_TABLE_NAME'
  )
  .option(
    '-t, --target-table <string>',
    'Target DynamoDB table name (prefix with $ to use env var)',
    '$TABLE_NAME'
  )
  .option('-p, --purge-target', 'Purge target table before migration')
  .option(
    '--keys <string>',
    'space-delimited list of key attributes',
    'entityPK entitySK'
  )
  .option(
    '--source-version <string>',
    'Source table version (prefix with $ to use env var)',
    '$LAST_TABLE_VERSION'
  )
  .option(
    '--target-version <string>',
    'Target table version (prefix with $ to use env var)',
    '$TABLE_VERSION'
  )
  .option(
    '--tables-path <string>',
    'Tables directory path relative to package root (prefix with $ to use env var)',
    'tables'
  )
  .option('-f, --force', 'proceed without confirmation (not recommended)')
  .action(
    async (
      {
        force,
        keys,
        purgeTarget,
        sourceTable,
        sourceVersion,
        tablesPath,
        targetTable,
        targetVersion,
      },
      command
    ) => {
      const { logger = console } = getDotenvCliOptions2Options(
        command.parent?.parent?.getDotenvCliOptions ?? {}
      );

      try {
        // Validate inputs.
        sourceTable = dotenvExpand(sourceTable);
        if (!sourceTable) throw new Error('Source table name is undefined.');

        targetTable = dotenvExpand(targetTable);
        if (!targetTable) throw new Error('Target table name is undefined.');

        keys = keys.split(' ');

        if (!keys.length) throw new Error('No key attributes specified.');

        if (sourceTable === targetTable) {
          logger.info(
            'Source and target table names are the same. No migration required.'
          );
          process.exit(0);
        }

        try {
          sourceVersion = _.toInteger(dotenvExpand(sourceVersion));
        } catch {
          throw new Error('Invalid source version.');
        }

        try {
          targetVersion = _.toInteger(dotenvExpand(targetVersion));
        } catch {
          throw new Error('Invalid target version.');
        }

        if (sourceVersion > targetVersion)
          throw new Error(
            'Source version cannot be greater than target version.'
          );

        // Get version transforms.
        tablesPath = dotenvExpand(tablesPath);
        if (!tablesPath) throw new Error('Tables path is undefined.');

        const tablesDir = resolve(await packageDirectory(), tablesPath);
        if (!(await fs.pathExists(tablesDir)))
          throw new Error('Tables path does not exist.');

        const versionDirs = await fs.readdir(tablesDir, {
          withFileTypes: true,
        });

        const transform = (
          await Promise.all(
            versionDirs.map(async (dir) => {
              // Skip non-directories.
              if (!dir.isDirectory()) return;

              // Skip excluded versions.
              const version = _.toInteger(dir.name);
              if (!(version > sourceVersion && version <= targetVersion))
                return;

              // Skip directories without a transform.js file.
              const transformPath = resolve(
                tablesDir,
                dir.name,
                'transform.js'
              );

              if (!(await fs.pathExists(transformPath))) return;

              // Load transform.
              const { default: transform } = await import(
                url.pathToFileURL(transformPath)
              );

              return {
                version,
                transform,
                // transform: new Function(
                //   `return ${(await fs.readFile(transformPath)).toString()}`
                // )(),
              };
            })
          )
        )
          .filter((dir) => !!dir)
          .sort((a, b) => a.version - b.version)
          .reduce(
            (t, { version, transform }) =>
              (entity) => {
                const lastResult = t(entity);

                if (_.isNil(lastResult)) return;

                try {
                  return transform(lastResult);
                } catch (error) {
                  throw new Error(
                    `Error transforming entity to version ${version}: ${error.message}`
                  );
                }
              },
            (entity) => entity
          );

        if (!force) {
          const confirmed = await confirm({
            message: `Are you sure you want to ${
              purgeTarget
                ? `purge all data from table '${targetTable}' and `
                : ''
            }migrate all data from table '${sourceTable}' to table '${targetTable}'? This action cannot be undone!`,
            default: false,
          });

          if (!confirmed) {
            logger.info(`Migration cancelled.`);
            process.exit(0);
          }
        }

        // Configure DynamoDB client.
        const db = new WrappedDynamoDbClient({
          logger,
        });

        // Validate tables.
        try {
          await db.describeTable(sourceTable);
        } catch {
          throw new Error(`Source table '${sourceTable}' does not exist.`);
        }

        try {
          await db.describeTable(targetTable);
        } catch {
          throw new Error(`Target table '${targetTable}' does not exist.`);
        }

        // Purge target table.
        if (purgeTarget) {
          logger.info(`Purging table '${targetTable}'...`);

          await db.purgeItems(targetTable, ['entityPK', 'entitySK']);

          logger.info(`Done.`);
          console.log('');
        }

        // Migrate data.
        logger.info(
          `Migrating data from table '${sourceTable}' to table '${targetTable}'...`
        );

        let migrated = 0;
        do {
          var { Items: items, LastEvaluatedKey: lastEvaluatedKey } =
            await db.scan(
              sourceTable,
              lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}
            );

          if (items.length) {
            await db.putItems(
              targetTable,
              items.map(transform).filter((item) => !_.isNil(item))
            );

            migrated += items.length;

            logger.info(`  migrated ${migrated} items.`);
          }
        } while (lastEvaluatedKey);

        logger.info(`Done.`);
        console.log('');
      } catch (error) {
        logger.error(error.message);
      }
    }
  );
