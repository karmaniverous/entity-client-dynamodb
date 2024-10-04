import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import AWSXray from 'aws-xray-sdk';

export interface DynamoDbClientConfig extends DynamoDBClientConfig {
  enableXray?: boolean;
}

export class DynamoDbClient {
  #client: unknown;

  constructor({ enableXray, ...config }: DynamoDbClientConfig) {
    const client = new DynamoDBClient(config);

    this.#client =
      enableXray && process.env.AWS_XRAY_DAEMON_ADDRESS
        ? AWSXray.captureAWSv3Client(client)
        : client;
  }
}
