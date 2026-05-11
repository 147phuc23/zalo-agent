# Admin App

`apps/admin` is the future operator dashboard for the Zalo workflow platform.

Primary use cases:

- manage tenant settings,
- configure vertical workflows for real estate and HR recruiting,
- review inbox conversations,
- approve or reject AI drafts,
- inspect CRM mappings, audit logs, and connector health.

Expected feature areas:

- `inbox`
- `workflows`
- `crm-mapping`
- `verticals`
- `operations`
- `settings`

Local development runs through the workspace root:

```bash
pnpm dev
```

The app should stay aligned with the docs in:

- `docs/architecture.md`
- `docs/verticals.md`
- `docs/bootstrap-plan.md`
