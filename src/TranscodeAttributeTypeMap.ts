import type { ScalarAttributeType } from '@aws-sdk/client-dynamodb';
import type {
  DefaultTranscodeMap,
  Exactify,
  TranscodeMap,
} from '@karmaniverous/entity-tools';

export type TranscodeAttributeTypeMap<T extends TranscodeMap> = {
  [P in keyof Exactify<T> as T[P] extends string
    ? never
    : P]?: ScalarAttributeType;
};

export const defaultTranscodeAttributeTypeMap: TranscodeAttributeTypeMap<DefaultTranscodeMap> =
  { bigint: 'N', fix6: 'N', int: 'N', number: 'N', timestamp: 'N' };
