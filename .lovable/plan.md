# Data Hub connection screen for PINK SHIELD

The Data Hub itself (datasets, annotation, quality checks, splits, experiments, models, access log) is built as a **separate Lovable project with its own database**, as your brief asks. Paste the first brief into that new project. This project gets only the secure connection side.

## What you will see here
- A new **«Интеграция Data Hub»** tab on the moderation page, visible to administrators only.
- It shows the connection status, the time of the last successful sync, recent errors, and a "Повторить" button.
- Until the Data Hub server address and a shared secret are added, it says plainly **«API не подключён»**. Nothing pretends to work.
- A reference list of the 9 Data Hub operations (datasets, versions, imports, quality checks, annotation batches, ML jobs, models), each with what it accepts and returns.

## Safety rules
- Only administrators can use it, and the server checks that on every call.
- The shared secret stays on the server. The browser never sees it or any other key.
- Only datasets marked approved or published, with an allowed purpose, are accepted.
- User documents, report texts and chats are never sent to the Data Hub.
- Data Hub content never becomes a source of medical answers. The navigator keeps using only the reviewed guidance library.
- Each call is logged with its result. Logs keep no health data.
- Requests time out, retry with a fixed job id so nothing runs twice, and are rate limited.

## Technical details
- `src/lib/data-hub.ts`: Zod schemas for the 9 contracts (request and response types).
- `src/lib/data-hub.functions.ts`: admin-only server functions (`requireSupabaseAuth` + `has_role`). They read `DATA_HUB_API_URL` and `DATA_HUB_API_SECRET` inside the handler. If either is missing, they return `{status:"not_connected"}` without making a network call. Otherwise they call the external API with a 10s timeout, an idempotency job_id, and 2 retries. A filter keeps only approved/published datasets with an allowed intended_use.
- Migration: an `integration_events` table (admin read via has_role, inserts only from the server, no health payload). Rate limit: at most N calls per admin per minute, counted from that table.
- The secrets are requested only once the Data Hub project exists and gives you its address.
- Tests: missing settings give not_connected, the dataset filter, Zod rejecting bad input, non-admin denied.
