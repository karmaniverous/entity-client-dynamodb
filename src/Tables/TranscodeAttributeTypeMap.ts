import type { ScalarAttributeType } from '@aws-sdk/client-dynamodb';
import type {
  DefaultTranscodeRegistry,
  Exactify,
  TranscodeRegistry,
} from '@karmaniverous/entity-tools';

/**
 * Maps non-string transcodes to a DynamoDB {@link ScalarAttributeType | `ScalarAttributeType`}.
 *
 * @category Tables
 */
export type TranscodeAttributeTypeMap<T extends TranscodeRegistry> = {
  [P in keyof Exactify<T> as T[P] extends string
    ? never
    : P]?: ScalarAttributeType;
};

/**
 * {@link TranscodeAttributeTypeMap | `TranscodeAttributeTypeMap`} object supporting default transcodes defined in {@link DefaultTranscodeRegistry | `DefaultTranscodeRegistry`}.
 *
 * @category Tables
 */
export const defaultTranscodeAttributeTypeMap: TranscodeAttributeTypeMap<DefaultTranscodeRegistry> =
  { bigint: 'N', fix6: 'N', int: 'N', number: 'N', timestamp: 'N' };
