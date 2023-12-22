# ghost-client

## Description

This client connects to an LND lightning node and enables Ghost payments.

## Config

```bash
PORT=3000 // Optional. Default is 3000

LND_NODE_SOCKET=127.0.0.1:10001
LND_NODE_MACAROON=021036...b42afd // Can be hex or base64 encoded
LND_NODE_CERT=2d2d2d...2d2d0a // Optional. Can be hex or base64 encoded
```

## Healthcheck

A healthcheck endpoint is enabled at `/health`.
