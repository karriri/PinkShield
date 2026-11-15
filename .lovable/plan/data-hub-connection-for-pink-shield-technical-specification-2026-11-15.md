# Data Hub connection for PINK SHIELD (technical specification)

The Data Hub itself (datasets, annotation, quality checks, splits, experiments, model registry, access log) is a **separate Lovable project with its own database**. You build it there from brief 01. This project adds only the secure connection side. All existing PINK SHIELD pages, design and features stay as they are.

## What you will see
- A new **«Интеграция Data Hub»** tab on the existing moderation page, for administrators only.
- The tab shows the connection state, the last successful sync, recent errors, a "Повторить проверку" button, and read-only lists of datasets and models fetched from the Data Hub.
- It shows nothing invented: no sample datasets, no fake syncs, no pretend experiments or model statuses. With no connection, it shows only the state and the reason.

## Connection states (exactly one at a time)
| State | When |
|---|---|
| `not_connected` | `DATA_HUB_API_URL` or `DATA_HUB_API_SECRET` is missing. No network call is made. |
| `connected` | The last health check (`GET /api/data-hub/datasets?limit=1`) returned a valid 2xx response. |
| `sync_in_progress` | A check is running. Shown in the UI only; never stored as a final result. |
| `sync_failed` | Timeout, network error, 5xx, 429 after retries, or a response that fails schema validation. |
| `authentication_failed` | The Data Hub answered 401 or 403. Not retried. |

## API contracts (Data Hub side; this app is the client)
All requests carry `Authorization: Bearer <DATA_HUB_API_SECRET>`, `X-Request-Id: <uuid>` and `Content-Type: application/json`. Every POST also carries `Idempotency-Key: <job_id>`. Responses are JSON.

The shared error body is `{ error: { code, message, request_id } }`.
- `400 invalid_request` — the request failed validation.
- `401 unauthenticated` — the secret is missing or wrong.
- `403 forbidden` — the caller lacks the needed scope, or the dataset's status or purpose is not allowed.
- `404 not_found`
- `409 idempotency_conflict` — the same key was sent with a different body.
- `413 payload_too_large`
- `415 unsupported_media_type`
- `422 validation_failed` — schema, checksum or licence problem.
- `429 rate_limited` — includes a `Retry-After` header.
- `500 internal_error`
- `503 unavailable`

Shared types:
- `DatasetStatus` = draft | in_review | approved | published | archived
- `PrivacyClass` = public | synthetic | deidentified | restricted
- `JobStatus` = queued | running | succeeded | failed | cancelled

### 1. List allowed datasets
`GET /api/data-hub/datasets`
- Request (query): `?status=approved|published&intended_use=string&limit=1..100(default 50)&cursor=string`
- Response 200: `{ items: [{ id: uuid, name, type, privacy_class, source, license, status, intended_use: string[], latest_version: string|null, updated_at: iso }], next_cursor: string|null }`
- Errors: 400, 401, 403, 429, 5xx

### 2. Dataset versions
`GET /api/data-hub/datasets/{id}/versions`
- Response 200: `{ dataset_id, items: [{ version, status, record_count: int>=0, schema_hash, checksum_sha256, validation_status: pending|passed|failed, provenance: string, created_at }] }`
- Errors: 400, 401, 403, 404, 429, 5xx

### 3. Create an import job
`POST /api/data-hub/import-jobs`
- Request: `{ job_id: uuid, dataset_id: uuid, version: string, file: { storage_path: string, mime: "text/csv"|"application/x-ndjson"|"application/json", size_bytes: int (1..524288000), checksum_sha256: hex64 }, schema_ref: string }`
- Response 202: `{ job_id, status: "queued", created_at }`. A repeat with the same key and body returns 200 with the existing job.
- Errors: 400, 401, 403, 409, 413, 415, 422, 429, 5xx

### 4. Import job status
`GET /api/data-hub/import-jobs/{id}`
- Response 200: `{ job_id, status: JobStatus, rows_total: int|null, rows_accepted: int|null, rows_rejected: int|null, duplicates: int|null, errors: [{ code, message, row: int|null }] (max 100), updated_at }`
- Errors: 401, 403, 404, 429, 5xx

### 5. Start a validation job
`POST /api/data-hub/validation-jobs`
- Request: `{ job_id: uuid, dataset_id: uuid, version: string, checks: ("schema"|"duplicates"|"empty_fields"|"class_balance"|"split_leakage")[] (min 1) }`
- Response 202: `{ job_id, status: "queued", created_at }`
- Errors: 400, 401, 403, 404, 409, 429, 5xx

### 6. Assign an annotation batch
`POST /api/data-hub/annotation-jobs`
- Request: `{ job_id: uuid, dataset_id: uuid, version: string, record_ids: uuid[] (1..1000), assignee_member_id: uuid, reviewer_member_id: uuid|null, guideline_ref: string }`
- Response 202: `{ job_id, status: "queued", assigned: int, created_at }`
- Errors: 400, 401, 403, 404, 409, 422, 429, 5xx

### 7. Queue an ML experiment
`POST /api/data-hub/ml-jobs`
- Request: `{ job_id: uuid, experiment_name: string(1..120), dataset_id: uuid, version: string, split_id: uuid, model_type: string, params: Record<string, string|number|boolean> (max 50 keys) }`
- Response 202: `{ job_id, status: "queued", created_at }`. Training runs on the Data Hub's servers, never in the browser.
- Errors: 400, 401, 403, 404, 409, 422, 429, 5xx

### 8. ML job status and metrics
`GET /api/data-hub/ml-jobs/{id}`
- Response 200: `{ job_id, status: JobStatus, metrics: Record<string, number>|null, artifact_uri: string|null, started_at: iso|null, finished_at: iso|null, error: string|null }`
- The UI says "обучено" only when the status is `succeeded` and an artifact exists.
- Errors: 401, 403, 404, 429, 5xx

### 9. List models
`GET /api/data-hub/models`
- Request (query): `?approval_status=pending|approved|rejected|retired&limit&cursor`
- Response 200: `{ items: [{ id, name, version, type, metrics: Record<string, number>, approval_status, dataset_version_ref, created_at }], next_cursor }`
- Errors: 400, 401, 403, 429, 5xx

### Rules on the client side
- Every response is validated with Zod. A response that fails validation counts as `sync_failed` (`invalid_response`) and its data is dropped.
- Datasets are kept only if their status is approved or published and their purpose is on the allow-list. Anything else is filtered out, even if the Data Hub returns it.
- Nothing from the Data Hub feeds the navigator, the report assistant or any medical answer.
- User documents, report texts, chats, appointments and profiles are never sent.

## Security
- `DATA_HUB_API_URL` and `DATA_HUB_API_SECRET` are server-only secrets. They are read inside server handlers, never use a `VITE_` prefix, and are never returned, logged or shown. I request them through the secure form only after the Data Hub project exists.
- Every server function uses `requireSupabaseAuth` and then checks `has_role(userId,'admin')` through the user's own client, before any other work. Non-admins get `403 forbidden`. Hiding the tab is only a convenience.
- The URL must be https. Redirects are not followed.
- Rate limit: at most 30 calls per admin per minute, counted in the audit table. Above that, the call is refused locally with `rate_limited`.

## Audit log
A new table `integration_events` stores:
- `id`, `created_at`, `actor_id` (admin uuid)
- `operation` (one of 9 names, or health_check)
- `job_id`, `request_id`
- `http_status`, `outcome` (one of the 5 states, or `ok` / an error code), `duration_ms`, `attempt`

It never stores request or response bodies, file names, dataset contents, health data, emails or secrets.

Access rules:
- Inserts come only from the server, through an authorized admin's own client.
- Admins can read the table. Nobody can update or delete rows.

## Retries and idempotency
- A `job_id` (uuid v4) is created once, when the admin starts an action. It is kept with the pending action and reused on every retry, so the Data Hub's `Idempotency-Key` stops duplicate imports or ML jobs.
- Timeout: 10 s per attempt. Up to 2 retries, with waits of 0.5 s and 1.5 s plus jitter.
  - Retried: network errors, timeouts, 429 (honouring `Retry-After`, capped at 5 s) and 5xx.
  - Never retried: 400, 401, 403, 404, 409, 413, 415, 422.
- GET calls retry the same way. A POST is retried only with the same key and body.

## Technical details (files)
- `src/lib/data-hub.ts`: pure code with the Zod schemas for all 9 contracts, the states, `mapHttpToState`, `filterAllowedDatasets`, and `fetchWithRetry(fetchFn, opts)` with an injectable fetch and clock for tests.
- `src/lib/data-hub.functions.ts`: admin-only server functions. They are `getDataHubStatus`, `listDataHubDatasets`, `listDataHubVersions`, `listDataHubModels`, `getJobStatus`, and `createJob(kind, payload with job_id)`.
- A new migration for `integration_events`, with its grants, RLS, and an index on (actor_id, created_at).
- `src/components/data-hub-panel.tsx`: the new tab, added to `src/routes/moderation.tsx` without changing the other tabs. It shows the state, the last success, the last 20 events, a retry button, and the dataset and model lists.
- The job-creation buttons stay disabled with "API не подключён" until the state is `connected`.

## Tests (vitest, `src/test/data-hub.test.ts`)
- Missing URL or secret gives `not_connected`, and fetch is never called.
- A non-admin caller is denied with `forbidden` before any fetch. A caller who is not signed in is unauthorized.
- 401 or 403 gives `authentication_failed`, with no retry.
- A malformed 200 body gives `sync_failed / invalid_response`, and no data is returned.
- A timeout leads to 3 attempts, then `sync_failed / timeout`.
- 503, then 503, then 200 gives `connected` after 3 attempts.
- 429 waits for `Retry-After` and retries.
- All retries of one POST send the same `Idempotency-Key` and the same body. 422 is not retried.
- A 409 from the Data Hub is shown as a conflict, not as success.
- The dataset filter drops draft, in_review, archived and disallowed-purpose items.
- An audit row built from a request never contains the payload or secret fields.


## Final security and accuracy requirements
- **Server address protection (SSRF):** The server checks `DATA_HUB_API_URL` on every call.
  - It must use https on the default port, with no user or password in the address.
  - The host must be a public domain name, not a raw IP. `localhost`, `*.local`, `*.internal` and `*.localhost` are rejected.
  - The host is looked up over DNS-over-HTTPS (A and AAAA records). The call is refused if any answer is in a blocked range: 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, 0/8, ::1, fc00::/7, fe80::/10, or IPv4-mapped forms.
  - Redirects are refused (`redirect: "manual"`; any 3xx counts as `sync_failed / unexpected_redirect`).
  - **Limitation:** the server runtime cannot pin the address it connects to, so DNS rebinding is reduced but not fully closed. The rest of the protection comes from the redirect ban and the platform's own outbound network isolation, which already blocks internal addresses.
- **Atomic rate limit:** A database function `data_hub_take_slot()` reserves one call. It locks the admin's own row in `integration_rate_limits` (`SELECT … FOR UPDATE` inside one statement), resets the window after 60 s, and then increments the counter or refuses.
  - Parallel requests queue on that row lock, so they can't get past 30 calls per minute.
  - The function runs as SECURITY DEFINER, checks `has_role(auth.uid(),'admin')`, and can only be run by signed-in users.
- **Health check vs sync:** These are stored and shown separately.
  - «Последняя успешная проверка связи» comes from a `health_check` event.
  - «Последняя успешная синхронизация данных» comes only from a full, schema-valid dataset or model list. A health check never counts as a sync.
  - Before the first sync, the panel shows «Синхронизация ещё не выполнялась».
- **Error responses:** Error bodies are validated against the shared schema too. A malformed error body becomes `invalid_error_response`.
  - The browser gets only a known code, a fixed Russian message and the request_id.
  - Raw server text, stack traces, headers and secrets are logged on the server only, with secrets removed, and never sent to the browser.
- **Append-only audit log:** Nobody, including administrators, can change or remove audit rows.
  - `integration_events` gives update and delete rights to no one.
  - It has no update or delete policies.
  - A trigger rejects any UPDATE or DELETE, even from the service role.
  - Direct inserts from the browser are also blocked. Rows are written only by the SECURITY DEFINER function `data_hub_log_event(...)`, which checks the admin role and sets `actor_id = auth.uid()` itself.

Added to the checklist (step 1 and the tests): the `integration_rate_limits` table and functions, the URL and IP checks, the redirect ban, parallel rate-limit tests (31 calls at the same time give exactly 30 allowed), tests that update and delete are refused on the audit log, the error-body schema test, and a test that health-check-only results show no sync.

## Implementation checklist
1. Add the migration for `integration_events` (grants, RLS: admin select, admin insert of their own rows only, no update or delete).
2. Write `src/lib/data-hub.ts`: schemas, states, error mapping, filter, retry helper.
3. Write `src/lib/data-hub.functions.ts`: auth and admin check, secret check, rate limit, call, validation, audit row.
4. Build `src/components/data-hub-panel.tsx` and add the tab to the moderation page.
5. Write the tests in `src/test/data-hub.test.ts` and run all tests, including the existing 32.
6. Check that the build is clean and that the other moderation tabs, navigator, report assistant, calendar and community still work.
7. In the browser as an admin, check that the tab shows `not_connected` and that job buttons are disabled. As a non-admin, check that a direct call is refused.
8. Run the security scan.
9. Record the integration rule in AGENTS.md.
10. When the Data Hub project's address is ready, request `DATA_HUB_API_URL` and `DATA_HUB_API_SECRET` through the secure form, with Generate for the shared secret.

Still waiting on you: which email should be the administrator. The tab and the admin checks can't be tested in the browser until that account exists.
