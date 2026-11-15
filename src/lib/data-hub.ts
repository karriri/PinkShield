/**
 * PINK SHIELD ↔ DATA HUB client contracts (pure, server- and test-safe).
 * Nothing here touches secrets; callers pass them in. Data Hub content is
 * never used for medical answers.
 */
import { z } from "zod";

export const CONNECTION_STATES = ["not_connected", "connected", "sync_in_progress", "sync_failed", "authentication_failed"] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

const iso = z.string().datetime({ offset: true });
const uuid = z.string().uuid();
const name = z.string().min(1).max(200);

export const DatasetStatus = z.enum(["draft", "in_review", "approved", "published", "archived"]);
export const PrivacyClass = z.enum(["public", "synthetic", "deidentified", "restricted"]);
export const JobStatus = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);

export const ERROR_CODES = ["invalid_request", "unauthenticated", "forbidden", "not_found", "idempotency_conflict", "payload_too_large", "unsupported_media_type", "validation_failed", "rate_limited", "internal_error", "unavailable"] as const;
export const ErrorBody = z.object({ error: z.object({ code: z.enum(ERROR_CODES), message: z.string().max(2000), request_id: z.string().max(100) }) });

export const Dataset = z.object({
  id: uuid, name, type: name, privacy_class: PrivacyClass, source: z.string().max(500), license: z.string().max(200),
  status: DatasetStatus, intended_use: z.array(z.string().max(60)).max(20), latest_version: z.string().max(60).nullable(), updated_at: iso,
});
export type Dataset = z.infer<typeof Dataset>;
const page = <T extends z.ZodTypeAny>(t: T) => z.object({ items: z.array(t).max(100), next_cursor: z.string().max(500).nullable() });
const queued = z.object({ job_id: uuid, status: z.literal("queued"), created_at: iso });
const version = z.string().min(1).max(60);
const metrics = z.record(z.string().max(60), z.number());

export const Schemas = {
  list_datasets: { method: "GET", res: page(Dataset) },
  list_versions: {
    method: "GET",
    res: z.object({ dataset_id: uuid, items: z.array(z.object({
      version, status: DatasetStatus, record_count: z.number().int().min(0), schema_hash: z.string().max(128), checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      validation_status: z.enum(["pending", "passed", "failed"]), provenance: z.string().max(1000), created_at: iso,
    })).max(200) }),
  },
  create_import: {
    method: "POST",
    req: z.object({ job_id: uuid, dataset_id: uuid, version, schema_ref: z.string().min(1).max(200), file: z.object({
      storage_path: z.string().min(1).max(500).regex(/^[\w\-./]+$/).refine((p) => !p.includes(".."), "path"),
      mime: z.enum(["text/csv", "application/x-ndjson", "application/json"]), size_bytes: z.number().int().min(1).max(524_288_000),
      checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/) }) }),
    res: queued,
  },
  get_import: {
    method: "GET",
    res: z.object({ job_id: uuid, status: JobStatus, rows_total: z.number().int().min(0).nullable(), rows_accepted: z.number().int().min(0).nullable(),
      rows_rejected: z.number().int().min(0).nullable(), duplicates: z.number().int().min(0).nullable(),
      errors: z.array(z.object({ code: z.string().max(60), message: z.string().max(500), row: z.number().int().nullable() })).max(100), updated_at: iso }),
  },
  create_validation: {
    method: "POST",
    req: z.object({ job_id: uuid, dataset_id: uuid, version, checks: z.array(z.enum(["schema", "duplicates", "empty_fields", "class_balance", "split_leakage"])).min(1).max(5) }),
    res: queued,
  },
  create_annotation: {
    method: "POST",
    req: z.object({ job_id: uuid, dataset_id: uuid, version, record_ids: z.array(uuid).min(1).max(1000), assignee_member_id: uuid, reviewer_member_id: uuid.nullable(), guideline_ref: z.string().min(1).max(200) }),
    res: queued.extend({ assigned: z.number().int().min(0) }),
  },
  create_ml_job: {
    method: "POST",
    req: z.object({ job_id: uuid, experiment_name: z.string().min(1).max(120), dataset_id: uuid, version, split_id: uuid, model_type: z.string().min(1).max(60),
      params: z.record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean()])).refine((p) => Object.keys(p).length <= 50, "too many params") }),
    res: queued,
  },
  get_ml_job: {
    method: "GET",
    res: z.object({ job_id: uuid, status: JobStatus, metrics: metrics.nullable(), artifact_uri: z.string().max(1000).nullable(), started_at: iso.nullable(), finished_at: iso.nullable(), error: z.string().max(1000).nullable() }),
  },
  list_models: {
    method: "GET",
    res: page(z.object({ id: uuid, name, version, type: name, metrics, approval_status: z.enum(["pending", "approved", "rejected", "retired"]), dataset_version_ref: z.string().max(200), created_at: iso })),
  },
} as const;
export type Operation = keyof typeof Schemas | "health_check";
export const OPERATIONS = [...Object.keys(Schemas), "health_check"] as Operation[];
export const JOB_OPS = ["create_import", "create_validation", "create_annotation", "create_ml_job"] as const;

export const ParamsSchema = z.object({
  id: uuid.optional(),
  status: z.enum(["approved", "published"]).optional(),
  intended_use: z.string().max(60).regex(/^[\w-]+$/).optional(),
  approval_status: z.enum(["pending", "approved", "rejected", "retired"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().max(500).regex(/^[\w\-=.]+$/).optional(),
}).strict();
export type Params = z.infer<typeof ParamsSchema>;

/** Builds the request path; ids are validated uuids, query values are encoded. */
export function buildPath(op: Operation, p: Params): string {
  const q = (keys: (keyof Params)[]) => {
    const s = new URLSearchParams();
    for (const k of keys) if (p[k] !== undefined) s.set(k, String(p[k]));
    const str = s.toString();
    return str ? `?${str}` : "";
  };
  const need = () => { if (!p.id) throw new Error("id required"); return encodeURIComponent(p.id); };
  switch (op) {
    case "health_check": return "/api/data-hub/datasets?limit=1";
    case "list_datasets": return `/api/data-hub/datasets${q(["status", "intended_use", "limit", "cursor"])}`;
    case "list_versions": return `/api/data-hub/datasets/${need()}/versions`;
    case "create_import": return "/api/data-hub/import-jobs";
    case "get_import": return `/api/data-hub/import-jobs/${need()}`;
    case "create_validation": return "/api/data-hub/validation-jobs";
    case "create_annotation": return "/api/data-hub/annotation-jobs";
    case "create_ml_job": return "/api/data-hub/ml-jobs";
    case "get_ml_job": return `/api/data-hub/ml-jobs/${need()}`;
    case "list_models": return `/api/data-hub/models${q(["approval_status", "limit", "cursor"])}`;
  }
}

/* ---------- SSRF protection ---------- */
const BLOCKED_HOST = /(^|\.)(localhost|local|internal|localdomain|home|lan|intranet|corp)$/i;

export function validateBaseUrl(raw: string | undefined): { ok: true; url: URL } | { ok: false; code: "not_configured" | "invalid_url" } {
  if (!raw) return { ok: false, code: "not_configured" };
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, code: "invalid_url" }; }
  if (u.protocol !== "https:" || u.port !== "" || u.username || u.password || u.search || u.hash) return { ok: false, code: "invalid_url" };
  const h = u.hostname.replace(/\.$/, "");
  if (!h.includes(".") || BLOCKED_HOST.test(h) || isIpLiteral(h)) return { ok: false, code: "invalid_url" };
  return { ok: true, url: u };
}

function isIpLiteral(h: string) { return /^[\d.]+$/.test(h) || h.startsWith("[") || h.includes(":") || /^0x/i.test(h); }

/** True for loopback, private, link-local, CGNAT, unspecified, multicast/reserved, ULA and mapped addresses. */
export function isBlockedIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isBlockedIp(mapped[1]);
    if (/^::ffff:/.test(v) || /^64:ff9b:/.test(v)) return true;
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || /^2001:db8/.test(v) || /^::/.test(v);
  }
  const parts = v.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const a = parts[0] ?? 0, b = parts[1] ?? 0;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** Resolves A/AAAA via DNS-over-HTTPS; refuses when any answer is blocked or none is found. */
export async function checkHostResolvesPublic(host: string, fetchFn: typeof fetch): Promise<boolean> {
  const ips: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const r = await fetchFn(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: "application/dns-json" }, redirect: "error" });
    if (!r.ok) return false;
    const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of j.Answer ?? []) if (a.type === 1 || a.type === 28) ips.push(a.data);
  }
  return ips.length > 0 && !ips.some(isBlockedIp);
}

/* ---------- calling with retries ---------- */
export type CallOk<T = unknown> = { ok: true; data: T; status: number; attempts: number };
export type CallErr = { ok: false; state: Exclude<ConnectionState, "connected" | "sync_in_progress">; code: string; status: number | null; attempts: number; requestId?: string | undefined };
export type CallResult<T = unknown> = CallOk<T> | CallErr;

export type CallOptions = {
  baseUrl: URL; secret: string; op: Operation; path: string; body?: unknown; jobId?: string | undefined; requestId: string;
  fetchFn: typeof fetch; sleep?: ((ms: number) => Promise<void>) | undefined; timeoutMs?: number | undefined; maxRetries?: number; random?: () => number;
};

const NO_RETRY = new Set([400, 401, 403, 404, 409, 413, 415, 422]);
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function callDataHub<T = unknown>(o: CallOptions): Promise<CallResult<T>> {
  const sleep = o.sleep ?? realSleep;
  const max = o.maxRetries ?? 2;
  const rnd = o.random ?? Math.random;
  const isPost = o.op !== "health_check" && Schemas[o.op as keyof typeof Schemas].method === "POST";
  const resSchema = o.op === "health_check" ? Schemas.list_datasets.res : Schemas[o.op].res;
  // Body is serialised once so every retry sends identical bytes with the same key.
  const bodyText = isPost ? JSON.stringify(o.body) : undefined;
  const headers: Record<string, string> = { authorization: `Bearer ${o.secret}`, "x-request-id": o.requestId, "content-type": "application/json", accept: "application/json" };
  if (isPost) { if (!o.jobId) return { ok: false, state: "sync_failed", code: "missing_job_id", status: null, attempts: 0 }; headers["idempotency-key"] = o.jobId; }
  const url = new URL(o.path, o.baseUrl);
  if (url.origin !== o.baseUrl.origin) return { ok: false, state: "sync_failed", code: "invalid_url", status: null, attempts: 0 };

  let last: CallErr = { ok: false, state: "sync_failed", code: "network_error", status: null, attempts: 0 };
  for (let attempt = 1; attempt <= max + 1; attempt++) {
    let retryAfterMs: number | null = null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 10_000);
    try {
      const res = await o.fetchFn(url.toString(), { method: isPost ? "POST" : "GET", headers, ...(bodyText !== undefined ? { body: bodyText } : {}), redirect: "manual", signal: ctrl.signal });
      const text = await res.text();
      clearTimeout(timer);
      if (res.status >= 300 && res.status < 400) return { ok: false, state: "sync_failed", code: "unexpected_redirect", status: res.status, attempts: attempt };
      let json: unknown;
      try { json = text ? JSON.parse(text) : null; } catch { json = undefined; }
      if (res.ok) {
        const parsed = resSchema.safeParse(json);
        if (!parsed.success) return { ok: false, state: "sync_failed", code: "invalid_response", status: res.status, attempts: attempt };
        if (isPost && (parsed.data as { job_id: string }).job_id !== o.jobId) return { ok: false, state: "sync_failed", code: "invalid_response", status: res.status, attempts: attempt };
        return { ok: true, data: parsed.data as T, status: res.status, attempts: attempt };
      }
      const err = ErrorBody.safeParse(json);
      const code = err.success ? err.data.error.code : "invalid_error_response";
      const requestId = err.success ? err.data.error.request_id : undefined;
      if (res.status === 401 || res.status === 403) return { ok: false, state: "authentication_failed", code: err.success ? code : "invalid_error_response", status: res.status, attempts: attempt, requestId };
      last = { ok: false, state: "sync_failed", code, status: res.status, attempts: attempt, requestId };
      if (NO_RETRY.has(res.status) || res.status < 500 && res.status !== 429) return last;
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after"));
        retryAfterMs = Number.isFinite(ra) && ra >= 0 ? Math.min(ra * 1000, 5000) : null;
      }
    } catch (e) {
      clearTimeout(timer);
      last = { ok: false, state: "sync_failed", code: ctrl.signal.aborted ? "timeout" : "network_error", status: null, attempts: attempt };
    }
    if (attempt <= max) await sleep(retryAfterMs ?? ([500, 1500][attempt - 1] ?? 1500) + Math.floor(rnd() * 250));
  }
  return last;
}

/* ---------- filtering, messages, audit ---------- */
/** Purposes PINK SHIELD accepts datasets for. Medical answers are never among them. */
export const ALLOWED_USES = ["research", "evaluation", "model_training"] as const;

export function filterAllowedDatasets(items: Dataset[], allowed: readonly string[] = ALLOWED_USES): Dataset[] {
  return items.filter((d) => (d.status === "approved" || d.status === "published") && d.intended_use.some((u) => allowed.includes(u)));
}

export const PUBLIC_MESSAGES: Record<string, string> = {
  not_configured: "API не подключён: адрес или ключ Data Hub не настроены.",
  invalid_url: "Адрес Data Hub не прошёл проверку безопасности.",
  unsafe_host: "Адрес Data Hub указывает на недопустимый сервер.",
  unauthenticated: "Data Hub не принял ключ доступа.",
  forbidden: "Недостаточно прав для этой операции.",
  invalid_error_response: "Data Hub вернул ответ в неожиданном формате.",
  invalid_response: "Data Hub вернул данные в неожиданном формате; они не показаны.",
  unexpected_redirect: "Data Hub попытался перенаправить запрос; запрос остановлен.",
  timeout: "Data Hub не ответил вовремя.",
  network_error: "Не удалось связаться с Data Hub.",
  rate_limited: "Слишком много запросов. Подождите минуту.",
  invalid_request: "Запрос отклонён: неверные данные.",
  not_found: "Объект не найден в Data Hub.",
  idempotency_conflict: "Задача с этим идентификатором уже существует с другими параметрами.",
  payload_too_large: "Файл слишком большой.",
  unsupported_media_type: "Неподдерживаемый тип файла.",
  validation_failed: "Data Hub отклонил данные при проверке.",
  internal_error: "Ошибка на стороне Data Hub.",
  unavailable: "Data Hub временно недоступен.",
  missing_job_id: "Нет идентификатора задачи.",
};
export const publicMessage = (code: string) => PUBLIC_MESSAGES[code] ?? "Неизвестная ошибка интеграции.";

export type AuditRow = { _operation: Operation; _job_id: string | null; _request_id: string; _http_status: number | null; _outcome: string; _is_sync: boolean; _duration_ms: number; _attempt: number };
const SYNC_OPS: Operation[] = ["list_datasets", "list_models"];

/** Builds the only fields that ever reach the audit log: no bodies, names, paths or secrets. */
export function buildAuditRow(op: Operation, r: CallResult, meta: { jobId?: string | undefined; requestId: string; durationMs: number }): AuditRow {
  return {
    _operation: op, _job_id: meta.jobId ?? null, _request_id: meta.requestId, _http_status: r.ok ? r.status : r.status,
    _outcome: r.ok ? "ok" : r.code.replace(/[^a-z_]/g, "").slice(0, 40) || "error",
    _is_sync: r.ok && SYNC_OPS.includes(op), _duration_ms: Math.max(0, Math.round(meta.durationMs)), _attempt: Math.max(1, r.attempts),
  };
}

export type EventRow = { operation: string; outcome: string; is_sync: boolean; created_at: string; http_status: number | null };
/** Health checks and data syncs are tracked separately; a health check never counts as a sync. */
export function summarizeEvents(events: EventRow[]) {
  const sorted = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    lastHealthOk: sorted.find((e) => e.operation === "health_check" && e.outcome === "ok")?.created_at ?? null,
    lastSyncOk: sorted.find((e) => e.is_sync && e.outcome === "ok" && e.operation !== "health_check")?.created_at ?? null,
  };
}

export function stateFor(r: CallResult): ConnectionState { return r.ok ? "connected" : r.state; }

/* ---------- orchestration (injectable for tests) ---------- */
type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
export type HubCtx = { supabase: { rpc: Rpc } | any; userId: string };
export type HubResponse = { state: ConnectionState; code: string | null; message: string | null; requestId: string | null; data: any };
export type HubDeps = { env: { url?: string | undefined; secret?: string | undefined }; fetchFn: typeof fetch; sleep?: ((ms: number) => Promise<void>) | undefined; timeoutMs?: number | undefined; skipDnsCheck?: boolean };

export async function assertAdmin(ctx: HubCtx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || data !== true) throw new Error("forbidden");
}

export async function runHubOperation(ctx: HubCtx, op: Operation, params: Params, body: unknown, jobId: string | undefined, deps: HubDeps): Promise<HubResponse> {
  await assertAdmin(ctx);
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const finish = async (r: CallResult): Promise<HubResponse> => {
    const { error } = await ctx.supabase.rpc("data_hub_log_event", buildAuditRow(op, r, { jobId, requestId, durationMs: Date.now() - started }));
    if (error) console.error("[data-hub] audit write failed");
    if (r.ok) return { state: "connected", code: null, message: null, requestId, data: r.data };
    return { state: stateFor(r), code: r.code, message: publicMessage(r.code), requestId: r.requestId ?? requestId, data: null };
  };
  const base = validateBaseUrl(deps.env.url);
  if (!deps.env.secret || (!base.ok && base.code === "not_configured")) {
    return { state: "not_connected", code: "not_configured", message: publicMessage("not_configured"), requestId, data: null };
  }
  if (!base.ok) return finish({ ok: false, state: "sync_failed", code: base.code, status: null, attempts: 1 });
  const { data: slot, error: slotErr } = await ctx.supabase.rpc("data_hub_take_slot");
  if (slotErr) throw new Error("forbidden");
  if (slot !== true) return finish({ ok: false, state: "sync_failed", code: "rate_limited", status: 429, attempts: 1 });
  if (!deps.skipDnsCheck) {
    let safe = false;
    try { safe = await checkHostResolvesPublic(base.url.hostname, deps.fetchFn); } catch { safe = false; }
    if (!safe) return finish({ ok: false, state: "sync_failed", code: "unsafe_host", status: null, attempts: 1 });
  }
  let path: string;
  try { path = buildPath(op, params); } catch { return finish({ ok: false, state: "sync_failed", code: "invalid_request", status: null, attempts: 1 }); }
  const r = await callDataHub({ baseUrl: base.url, secret: deps.env.secret, op, path, body, jobId, requestId, fetchFn: deps.fetchFn, sleep: deps.sleep, timeoutMs: deps.timeoutMs });
  if (r.ok && (op === "list_datasets" || op === "health_check")) {
    const d = r.data as { items: Dataset[]; next_cursor: string | null };
    r.data = { ...d, items: filterAllowedDatasets(d.items) };
  }
  return finish(r);
}
