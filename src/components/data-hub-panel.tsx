import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dataHubConfigured, dataHubRead, type HubResponse } from "@/lib/data-hub.functions";
import { summarizeEvents, type ConnectionState } from "@/lib/data-hub";

const STATE_LABEL: Record<ConnectionState, string> = {
  not_connected: "API не подключён",
  connected: "Подключено",
  sync_in_progress: "Идёт проверка…",
  sync_failed: "Ошибка связи",
  authentication_failed: "Ошибка доступа (ключ не принят)",
};
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("ru-RU") : null);

export function DataHubPanel() {
  const qc = useQueryClient();
  const configuredFn = useServerFn(dataHubConfigured);
  const readFn = useServerFn(dataHubRead);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<HubResponse | null>(null);
  const [datasets, setDatasets] = useState<{ id: string; name: string; status: string; latest_version: string | null }[] | null>(null);
  const [models, setModels] = useState<{ id: string; name: string; version: string; approval_status: string }[] | null>(null);

  const configured = useQuery({ queryKey: ["data-hub-configured"], queryFn: () => configuredFn() });
  const events = useQuery({
    queryKey: ["integration-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("integration_events").select("operation,outcome,is_sync,created_at,http_status,attempt").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const summary = summarizeEvents(events.data ?? []);
  const notConnected = configured.data && !configured.data.configured;
  const state: ConnectionState = busy ? "sync_in_progress" : notConnected ? "not_connected" : last?.state ?? "not_connected";

  async function check() {
    setBusy(true);
    try {
      const h: HubResponse = await readFn({ data: { op: "health_check", params: {} } });
      setLast(h);
      if (h.state === "connected") {
        const d: HubResponse = await readFn({ data: { op: "list_datasets", params: { limit: 50 } } });
        const m: HubResponse = await readFn({ data: { op: "list_models", params: { limit: 50 } } });
        setDatasets(d.state === "connected" ? ((d.data as { items: never[] }).items) : null);
        setModels(m.state === "connected" ? ((m.data as { items: never[] }).items) : null);
        if (d.state !== "connected") setLast(d); else if (m.state !== "connected") setLast(m);
      }
    } catch {
      setLast({ state: "sync_failed", code: "forbidden", message: "Недостаточно прав или сессия истекла.", requestId: null, data: null });
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["integration-events"] });
    }
  }

  return (
    <div className="grid gap-4 text-sm">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Состояние</p>
            <p className="font-display text-2xl font-semibold text-primary">{STATE_LABEL[state]}</p>
            {state === "not_connected" && <p className="mt-1 text-muted-foreground">Адрес и ключ Data Hub ещё не добавлены. Данные не запрашиваются и не имитируются.</p>}
            {last?.message && state !== "not_connected" && !busy && <p className="mt-1 text-destructive">{last.message}{last.requestId ? ` (запрос ${last.requestId.slice(0, 8)})` : ""}</p>}
          </div>
          <Button onClick={check} disabled={busy || !configured.data?.configured}>Повторить проверку</Button>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Последняя успешная проверка связи</dt><dd>{fmt(summary.lastHealthOk) ?? "Ещё не было"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Последняя успешная синхронизация данных</dt><dd>{fmt(summary.lastSyncOk) ?? "Синхронизация ещё не выполнялась"}</dd></div>
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-semibold">Разрешённые датасеты</h3>
          {datasets === null ? <p className="mt-2 text-muted-foreground">Нет данных: синхронизация не выполнялась.</p>
            : datasets.length === 0 ? <p className="mt-2 text-muted-foreground">Data Hub не вернул разрешённых датасетов.</p>
            : <ul className="mt-2 grid gap-1">{datasets.map((d) => <li key={d.id}>{d.name} · {d.status}{d.latest_version ? ` · v${d.latest_version}` : ""}</li>)}</ul>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-semibold">Модели</h3>
          {models === null ? <p className="mt-2 text-muted-foreground">Нет данных: синхронизация не выполнялась.</p>
            : models.length === 0 ? <p className="mt-2 text-muted-foreground">Data Hub не вернул моделей.</p>
            : <ul className="mt-2 grid gap-1">{models.map((m) => <li key={m.id}>{m.name} {m.version} · {m.approval_status}</li>)}</ul>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">Задачи (импорт, проверка, разметка, ML)</h3>
        <p className="mt-1 text-muted-foreground">Запуск задач выполняется в самом Data Hub. Обучение никогда не идёт в браузере.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Импорт", "Проверка качества", "Разметка", "ML-эксперимент"].map((l) => <Button key={l} size="sm" variant="outline" disabled>{l}</Button>)}
        </div>
        {state !== "connected" && <p className="mt-2 text-xs text-muted-foreground">Недоступно: API не подключён.</p>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">Журнал (последние 20)</h3>
        <p className="text-xs text-muted-foreground">Журнал только для чтения. В нём нет медицинских, личных данных и ключей.</p>
        {!events.data?.length ? <p className="mt-2 text-muted-foreground">Записей пока нет.</p> : (
          <ul className="mt-2 grid gap-1 font-mono text-xs">
            {events.data.slice(0, 20).map((e, i) => <li key={i}>{fmt(e.created_at)} · {e.operation} · {e.outcome}{e.http_status ? ` · ${e.http_status}` : ""} · попытка {e.attempt}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
