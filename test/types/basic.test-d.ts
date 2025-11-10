import type { BaseConfigMap } from '@karmaniverous/entity-manager';
import type { DefaultTranscodeMap } from '@karmaniverous/entity-tools';
import { expectAssignable, expectType } from 'tsd';

import {
  defaultTranscodeAttributeTypeMap,
  EntityClient,
  type EntityClientOptions,
  type TranscodeAttributeTypeMap,
} from '..';

// defaultTranscodeAttributeTypeMap matches its declared type
expectType<TranscodeAttributeTypeMap<DefaultTranscodeMap>>(
  defaultTranscodeAttributeTypeMap,
);

// Minimal config type for EntityClient generic sanity
interface Cfg extends BaseConfigMap {
  EntityMap: Record<string, Record<string, unknown>>;
  HashKey: 'hashKey';
  RangeKey: 'rangeKey';
  ShardedKeys: never;
  UnshardedKeys: never;
  TranscodedProperties: string;
}

// EntityClient constructor options assignability smoke test
const opts: EntityClientOptions<Cfg> = {
  entityManager: {} as any, // not executed in type tests
  region: 'local',
  tableName: 't',
};

expectAssignable<EntityClient<Cfg>>(new EntityClient<Cfg>(opts as any));
