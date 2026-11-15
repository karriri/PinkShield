import { describe, expect, it, vi } from "vitest";
import {
  buildAuditRow, callDataHub, filterAllowedDatasets, isBlockedIp, runHubOperation, summarizeEvents, validateBaseUrl, type Dataset,
} from "@/lib/data-hub";

const BASE = new URL("https://hub.example.org");
const RID = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const ds = (o: Partial<Dataset> = {}): Dataset => ({
  id: "33333333-3333-4333-8333-333333333333", name: "Synthetic set", type: "tabular", privacy_class: "synthetic", source: "s", license: "CC-BY",
  status: "approved", intended_use: ["research"], latest_version: "1", updated_at: "2026-11-01T00:00:00Z", ...o,
});
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const errBody = (code: string) => ({ error: { code, message: "x", request_id: "r1" } });
const noSleep = vi.fn(async () => {});
const call = (fetchFn: typeof fetch, extra: object = {}) =>
  callDataHub({ baseUrl: BASE, secret: "s3cr3t", op: "list_datasets", path: "/api/data-hub/datasets", requestId: RID, fetchFn, sleep: noSleep, ...extra });
const mlBody = { job_id: JOB, experiment_name: "e", dataset_id: ds().id, version: "1", split_id: ds().id, model_type: "lr", params: {} };

function ctx(isAdmin: boolean, slot = true) {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  return {
    calls,
    ctx: { userId: "u1", supabase: { rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "has_role") return { data: isAdmin, error: null };
      if (fn === "data_hub_take_slot") return { data: slot, error: null };
      return { data: null, error: null };
    } } },
  };
}

describe("Data Hub access", () => {
  it("non-admin is refused before any network call", async () => {
    const f = vi.fn();
    await expect(runHubOperation(ctx(false).ctx, "health_check", {}, undefined, undefined, { env: { url: BASE.href, secret: "s" }, fetchFn: f as never })).rejects.toThrow("forbidden");
    expect(f).not.toHaveBeenCalled();
  });
  it("missing secret or URL gives not_connected and makes no call", async () => {
    const f = vi.fn();
    for (const env of [{ url: BASE.href }, { secret: "s" }, {}]) {
      const r = await runHubOperation(ctx(true).ctx, "health_check", {}, undefined, undefined, { env, fetchFn: f as never });
      expect(r.state).toBe("not_connected");
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("rate limit refusal blocks the call and is logged", async () => {
    const f = vi.fn(); const c = ctx(true, false);
    const r = await runHubOperation(c.ctx, "health_check", {}, undefined, undefined, { env: { url: BASE.href, secret: "s" }, fetchFn: f as never, skipDnsCheck: true });
    expect(r.code).toBe("rate_limited");
    expect(f).not.toHaveBeenCalled();
    expect(c.calls.some((x) => x.fn === "data_hub_log_event")).toBe(true);
  });
  it("audit goes only through data_hub_log_event, without secrets or payload", async () => {
    const c = ctx(true);
    await runHubOperation(c.ctx, "create_ml_job", {}, mlBody, JOB, { env: { url: BASE.href, secret: "s3cr3t" }, fetchFn: (async () => json(202, { job_id: JOB, status: "queued", created_at: "2026-11-15T00:00:00Z" })) as never, skipDnsCheck: true });
    const log = c.calls.find((x) => x.fn === "data_hub_log_event")!;
    const text = JSON.stringify(log.args);
    expect(text).not.toContain("s3cr3t");
    expect(text).not.toContain("experiment_name");
    expect(Object.keys(log.args!).sort()).toEqual(["_attempt", "_duration_ms", "_http_status", "_is_sync", "_job_id", "_operation", "_outcome", "_request_id"]);
  });
});

describe("SSRF protection", () => {
  it.each(["http://hub.example.org", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://hub.internal", "https://u:p@hub.example.org", "https://hub.example.org:8443", "https://10.0.0.1", "https://intranet"])("rejects %s", (u) => {
    expect(validateBaseUrl(u).ok).toBe(false);
  });
  it("accepts a public https host", () => expect(validateBaseUrl("https://hub.example.org").ok).toBe(true));
  it.each(["127.0.0.1", "10.2.3.4", "172.20.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  it("allows a public IP", () => expect(isBlockedIp("93.184.216.34")).toBe(false));
  it("rejects redirects", async () => {
    const r = await call((async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254" } })) as never);
    expect(r).toMatchObject({ ok: false, code: "unexpected_redirect" });
  });
});

describe("Responses, errors and retries", () => {
  it("401/403 → authentication_failed, no retry", async () => {
    for (const s of [401, 403]) {
      const f = vi.fn(async () => json(s, errBody(s === 401 ? "unauthenticated" : "forbidden")));
      const r = await call(f as never);
      expect(r).toMatchObject({ ok: false, state: "authentication_failed" });
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it("malformed success body → invalid_response, no data", async () => {
    const r = await call((async () => json(200, { items: [{ id: "nope" }], next_cursor: null })) as never);
    expect(r).toMatchObject({ ok: false, state: "sync_failed", code: "invalid_response" });
    expect("data" in r).toBe(false);
  });
  it("malformed error body → invalid_error_response, raw text not exposed", async () => {
    const r = await call((async () => new Response("Traceback: secret stack", { status: 400 })) as never);
    expect(r).toMatchObject({ ok: false, code: "invalid_error_response" });
    expect(JSON.stringify(r)).not.toContain("Traceback");
  });
  it("timeout retries then reports timeout after 3 attempts", async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("abort")))));
    const r = await call(f as never, { timeoutMs: 5 });
    expect(r).toMatchObject({ ok: false, code: "timeout", attempts: 3 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("503, 503, 200 → connected on attempt 3", async () => {
    const seq = [json(503, errBody("unavailable")), json(503, errBody("unavailable")), json(200, { items: [ds()], next_cursor: null })];
    const r = await call((async () => seq.shift()!) as never);
    expect(r).toMatchObject({ ok: true, attempts: 3 });
  });
  it("429 honours Retry-After (capped at 5 s)", async () => {
    const sleep = vi.fn(async () => {});
    const seq = [json(429, errBody("rate_limited"), { "retry-after": "60" }), json(200, { items: [], next_cursor: null })];
    const r = await call((async () => seq.shift()!) as never, { sleep });
    expect(r.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(5000);
  });
  it("POST retries reuse the same Idempotency-Key and body; 422 is not retried", async () => {
    const seen: { key: string | null; body: string }[] = [];
    const seq = [json(500, errBody("internal_error")), json(202, { job_id: JOB, status: "queued", created_at: "2026-11-15T00:00:00Z" })];
    const f = async (_u: string, init: RequestInit) => { seen.push({ key: (init.headers as Record<string, string>)["idempotency-key"], body: String(init.body) }); return seq.shift()!; };
    const r = await call(f as never, { op: "create_ml_job", path: "/api/data-hub/ml-jobs", body: mlBody, jobId: JOB });
    expect(r.ok).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual(seen[1]);
    expect(seen[0].key).toBe(JOB);
    const g = vi.fn(async () => json(422, errBody("validation_failed")));
    await call(g as never, { op: "create_ml_job", path: "/api/data-hub/ml-jobs", body: mlBody, jobId: JOB });
    expect(g).toHaveBeenCalledTimes(1);
  });
  it("409 is a conflict, never success", async () => {
    const r = await call((async () => json(409, errBody("idempotency_conflict"))) as never, { op: "create_ml_job", path: "/api/data-hub/ml-jobs", body: mlBody, jobId: JOB });
    expect(r).toMatchObject({ ok: false, code: "idempotency_conflict" });
  });
  it("POST without job_id is refused", async () => {
    const f = vi.fn();
    const r = await call(f as never, { op: "create_ml_job", path: "/api/data-hub/ml-jobs", body: mlBody });
    expect(r).toMatchObject({ ok: false, code: "missing_job_id" });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("Filtering and summaries", () => {
  it("keeps only approved/published with allowed purpose", () => {
    const items = [ds(), ds({ status: "published" }), ds({ status: "draft" }), ds({ status: "in_review" }), ds({ status: "archived" }), ds({ intended_use: ["medical_answers"] })];
    expect(filterAllowedDatasets(items)).toHaveLength(2);
  });
  it("a health check never counts as a sync", () => {
    const s = summarizeEvents([{ operation: "health_check", outcome: "ok", is_sync: false, created_at: "2026-11-15T10:00:00Z", http_status: 200 }]);
    expect(s.lastHealthOk).toBe("2026-11-15T10:00:00Z");
    expect(s.lastSyncOk).toBeNull();
    const row = buildAuditRow("health_check", { ok: true, data: {}, status: 200, attempts: 1 }, { requestId: RID, durationMs: 3 });
    expect(row._is_sync).toBe(false);
  });
});
