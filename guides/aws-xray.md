---
title: AWS X-Ray
---

# AWS X-Ray

Enable AWS X-Ray capture for the internal DynamoDB client using guarded capture.

```ts
import { EntityClient } from '@karmaniverous/entity-client-dynamodb';

const client = new EntityClient({
  entityManager,
  tableName: 'UserTable',
  region: 'us-east-1',
  // X-Ray capture mode: 'off' | 'auto' | 'on'
  // - 'off': never capture
  // - 'auto': capture only when AWS_XRAY_DAEMON_ADDRESS is set
  // - 'on': force capture (requires AWS_XRAY_DAEMON_ADDRESS)
  xray: 'auto',
});
```

Notes

- X-Ray capture is applied to the AWS SDK v3 client.
- In `xray: 'auto'` mode, capture is enabled only when `AWS_XRAY_DAEMON_ADDRESS` is set.
- In `xray: 'on'` mode, missing `AWS_XRAY_DAEMON_ADDRESS` is treated as an error by the capture helper.
