import type {
  BaseShardQueryMapBuilderOptions,
  EntityMap,
} from '@karmaniverous/entity-manager';
import type { Exactify, TranscodeMap } from '@karmaniverous/entity-tools';

import { EntityClient } from './EntityClient';
import { EntityClientOptions } from './EntityClientOptions';

/**
 * {@link ShardQueryMapBuilder | `ShardQueryMapBuilder`} constructor options.
 */
export interface ShardQueryMapBuilderOptions<
  EntityToken extends keyof Exactify<M> & string,
  M extends EntityMap,
  HashKey extends string,
  RangeKey extends string,
  T extends TranscodeMap,
> extends BaseShardQueryMapBuilderOptions<
    EntityClient,
    EntityClientOptions,
    EntityToken,
    M,
    HashKey,
    RangeKey,
    T
  > {
  /** Table name. */
  tableName?: string;
}
