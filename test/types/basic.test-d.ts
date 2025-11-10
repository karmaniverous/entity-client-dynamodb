import {
  defaultTranscodeAttributeTypeMap,
  type EntityClientOptions,
  type TranscodeAttributeTypeMap,
} from '@karmaniverous/entity-client-dynamodb';
import type {
  BaseConfigMap,
  EntityManager,
} from '@karmaniverous/entity-manager';
import type { DefaultTranscodeMap } from '@karmaniverous/entity-tools';
import { expectAssignable, expectType } from 'tsd';

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
const fakeEm = null as unknown as EntityManager<Cfg>;
const opts: EntityClientOptions<Cfg> = {
  entityManager: fakeEm,
  region: 'local',
  tableName: 't',
};

expectAssignable<EntityClientOptions<Cfg>>(opts);
