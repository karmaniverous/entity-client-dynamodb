---
title: CLI Usage Recipes
---

# CLI Usage Recipes

Compose YAML for a new version

```bash
mycli aws dynamodb generate --version 001
```

Validate generated sections vs EM

```bash
mycli aws dynamodb validate --version 001
```

Create with refresh and TableName override

```bash
mycli aws dynamodb create --version 001 \
  --refresh-generated \
  --table-name-override MyTable \
  --max-seconds 120
```

Delete and purge (CI-friendly)

```bash
mycli aws dynamodb delete --table-name MyTable --version 001 --max-seconds 30 --force
mycli aws dynamodb purge  --table-name MyTable --version 001 --force
```

Migrate data with progress

```bash
mycli aws dynamodb migrate \
  --source-table Source \
  --target-table Target \
  --from-version 001 \
  --to-version 002 \
  --page-size 100 \
  --transform-concurrency 4 \
  --progress-interval-ms 2000 \
  --force
```

## Local DynamoDB (quick recipes)

Config‑first (Docker Compose) — add to getdotenv config:

```json
{
  "plugins": {
    "aws/dynamodb": {
      "local": {
        "port": 8000,
        "endpoint": "http://localhost:8000",
        "start": "docker compose up -d dynamodb",
        "stop": "docker compose stop dynamodb",
        "status": "docker ps --format '{{.Names}}' | grep -q dynamodb"
      }
    }
  }
}
```

Usage:

```bash
# Start and wait until ready (prints endpoint + export hint)
mycli aws dynamodb local start

# Status (exit 0 when healthy)
mycli aws dynamodb local status

# Stop
mycli aws dynamodb local stop
```

Embedded fallback (no config commands):

```bash
# Install the optional peer to enable the embedded path
npm i -D @karmaniverous/dynamodb-local

# Start and wait until ready using the library, then probe readiness
mycli aws dynamodb local start
```

Notes

- start blocks until Local is healthy; there is no separate “ready” command.
- Endpoint is derived in this order: config endpoint > config port > `DYNAMODB_LOCAL_ENDPOINT` > `DYNAMODB_LOCAL_PORT` (default 8000).
