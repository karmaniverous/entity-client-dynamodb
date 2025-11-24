# AWS X-Ray

Enable AWS X-Ray capture for the internal DynamoDB client when an X-Ray daemon is available.

```ts
import { EntityClient } from '@karmaniverous/entity-client-dynamodb';

const client = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'us-east-1',
  enableXray: true,
});
```

Notes

- X-Ray is applied to the AWS SDK v3 client; ensure your environment is wired with the X-Ray daemon.
