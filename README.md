# Zalo x Twenty Platform

Single-repo bootstrap for an AI operations platform that receives Zalo personal-account messages through an isolated connector and supports two primary verticals:

- real-estate teams handling buyer, renter, seller, and landlord conversations,
- HR recruiting teams handling candidate, client-firm, and job-opening conversations.

Twenty stays as a standalone CRM workspace for operator-facing records, while the app owns channel state, workflows, audit trails, and AI/tool orchestration.

## What is initialized

- `services/zalo-connector`: first runnable connector that logs in with `zca-js`, normalizes inbound messages, and persists them locally.
- `services/api`: placeholder for the future platform API gateway.
- `services/worker`: placeholder for the future workflow and agent worker.
- `apps/admin`: placeholder for the future admin UI.
- `packages/shared`: shared contracts and message normalization helpers.
- `docker-compose.yml`: standalone Twenty CRM stack.
- `docs/bootstrap-plan.md`: architecture notes and prioritized todo list.
- `docs/architecture.md`: service boundaries, diagrams, and build phases.
- `docs/verticals.md`: domain brief for real-estate and HR recruiting workflows.

## First-run commands

1. Copy your environment into `.env.local` and set at least:
   - `INTERNAL_INGEST_TOKEN`
   - `REDIS_URL`

```bash
cp .env.local.example .env.local
```

2. Start Twenty, API, and worker:

```bash
pnpm dev:up
```

3. In another terminal, start the Zalo connector once you have credentials:

```bash
INTERNAL_INGEST_TOKEN=$INTERNAL_INGEST_TOKEN API_BASE_URL=http://localhost:${APP_PORT:-7010} TENANT_ID=11111111-1111-1111-1111-111111111111 pnpm zalo:listen
```

4. Verify the API:

```bash
curl http://localhost:7010/health
curl http://localhost:7010/ready
```

5. Smoke-test ingest and readback:

```bash
curl -X POST http://localhost:7010/internal/events \
  -H "content-type: application/json" \
  -H "authorization: Bearer $INTERNAL_INGEST_TOKEN" \
  -d '{
    "events": [
      {
        "kind": "message.received",
        "tenantId": "11111111-1111-1111-1111-111111111111",
        "channel": "zalo",
        "threadId": "smoke-thread-1",
        "senderExternalId": "smoke-user-1",
        "messageType": "text",
        "text": "hello from smoke test",
        "receivedAt": "2026-05-05T10:00:00.000Z",
        "idempotencyKey": "smoke-thread-1:hello",
        "rawPayload": { "source": "smoke-test" }
      }
    ]
  }'

curl "http://localhost:7010/internal/conversations?tenantId=11111111-1111-1111-1111-111111111111&limit=5" \
  -H "authorization: Bearer $INTERNAL_INGEST_TOKEN"
```

### Local services

- Twenty is available at `http://localhost:7300`.
- API is available at `http://localhost:7010`.
- `pnpm dev:down` stops Docker services.

## Demo data

The current implementation still seeds three generic demo tenants:

- `sales-demo`
- `support-demo`
- `booking-demo`

These should be replaced as the product is reoriented toward:

- `real-estate-demo`
- `hr-recruiting-demo`
- `mixed-ops-demo`

Each tenant gets contacts, conversations, messages, workflow configs, knowledge docs, and a few sample handoff tasks.

## Notes

- `zca-js` is unofficial and should stay isolated behind the connector boundary.
- The current connector stores session and inbound messages locally so we can prove the receive path before adding Redis, BullMQ, or a proper API service.
- The current codebase is still generic in several places. The planning docs now treat real estate and HR recruiting as the primary supported verticals.
