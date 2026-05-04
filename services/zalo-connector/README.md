# Zalo Connector

This service isolates the unofficial `zca-js` integration from the rest of the platform.

## What it does now

- logs in using saved credentials or QR flow,
- starts the Zalo web listener,
- normalizes text messages,
- writes inbound events to `data/inbound.ndjson`.

## Run

```bash
node src/index.js
```

## Files

- `data/credentials.json`: saved session context after QR login.
- `data/inbound.ndjson`: normalized inbound event log.

## Next upgrades

- encrypt credentials at rest,
- publish to Redis/BullMQ instead of local file,
- expose a health endpoint,
- add outbound send command handling.
