import type { ScalarAttributeType } from '@aws-sdk/client-dynamodb';
import type {
  DefaultTranscodeMap,
  Exactify,
  TranscodeMap,
} from '@karmaniverous/entity-tools';

/**
 * Maps non-string transcodes to a DynamoDB {@link ScalarAttributeType | `ScalarAttributeType`}.
 *
 * @category Tables
 */
export type TranscodeAttributeTypeMap<T extends TranscodeMap> = {
  [P in keyof Exactify<T> as T[P] extends string
    ? never
    : P]?: ScalarAttributeType;
};

/**
 * {@link TranscodeAttributeTypeMap | `TranscodeAttributeTypeMap`} object supporting default transcodes defined in {@link DefaultTranscodeMap | `DefaultTranscodeMap`}.
 *
 * @category Tables
 */
export const defaultTranscodeAttributeTypeMap: TranscodeAttributeTypeMap<DefaultTranscodeMap> =
  { bigint: 'N', fix6: 'N', int: 'N', number: 'N', timestamp: 'N' };
