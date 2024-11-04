import { toInt } from 'radash';

export const env = {
  dynamoDbLocalPort: toInt(process.env.DYNAMODB_LOCAL_PORT ?? '8000'),
};
