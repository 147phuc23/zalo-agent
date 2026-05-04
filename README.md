# Zalo x Twenty Platform

Single-repo bootstrap for an AI CRM platform that receives Zalo personal-account messages through an isolated connector and keeps Twenty CRM as a standalone service.

## What is initialized

- `services/zalo-connector`: first runnable connector that logs in with `zca-js`, normalizes inbound messages, and persists them locally.
- `services/api`: placeholder for the future platform API gateway.
- `services/worker`: placeholder for the future workflow and agent worker.
- `apps/admin`: placeholder for the future admin UI.
- `packages/shared`: shared contracts and message normalization helpers.
- `docker-compose.yml`: standalone Twenty CRM stack.
- `docs/bootstrap-plan.md`: architecture notes and prioritized todo list.

## First-run commands

Start Twenty:

```bash
docker compose up -d
```

Run the Zalo connector:

```bash
node services/zalo-connector/src/index.js
```

Twenty will be available at `http://localhost:4000`.

## Notes

- `zca-js` is unofficial and should stay isolated behind the connector boundary.
- The current connector stores session and inbound messages locally so we can prove the receive path before adding Redis, BullMQ, or a proper API service.
