import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app-shell";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { REPORT_REASONS, type ReportReason } from "@/lib/community";

export const Route = createFileRoute("/moderation")({
  head: () => ({
    meta: [
      { title: "Модерация — PINK SHIELD" },
      { name: "description", content: "Инструменты модераторов сообщества PINK SHIELD." },
      { property: "og:title", content: "Модерация — PINK SHIELD" },
      { property: "og:description", content: "Только для модераторов." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Moderation,
});

const ACTION_LABEL: Record<string, string> = { remove_content: "Контент удалён", restore_content: "Контент восстановлен", suspend: "Аккаунт приостановлен", mute: "Публикации ограничены", lift: "Ограничение снято", resolve: "Жалоба решена", dismiss: "Жалоба отклонена" };

function Moderation() {
  const { userId, ready } = useAuth();
  const { data: isAdmin, isLoading } = useIsAdmin();
  if (ready && !userId) return <SignInPrompt text="Раздел доступен только модераторам." />;
  if (isLoading || !ready) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (!isAdmin) return (<><PageHeader title="Модерация" /><p className="rounded-3xl bg-blush p-8 text-center text-muted-foreground">Нет доступа. Этот раздел доступен только модераторам.</p></>);
  return <Dashboard />;
}

function Dashboard() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "closed">("open");
  const reports = useQuery({
    queryKey: ["mod-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_reports")
        .select("*, posts(id,body,author_id,author_name,removed_at), comments(id,body,author_id,author_name,removed_at)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["mod-history"],
    queryFn: async () => (await supabase.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const restrictions = useQuery({
    queryKey: ["mod-restrictions"],
    queryFn: async () => (await supabase.from("account_restrictions").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function log(action: string, extra: { report_id?: string; post_id?: string | null; comment_id?: string | null; target_user_id?: string | null; note?: string }) {
    await supabase.from("moderation_actions").insert({ action, ...extra, note: extra.note ?? "" });
    qc.invalidateQueries({ queryKey: ["mod-history"] });
  }
  async function closeReport(id: string, s: "resolved" | "dismissed") {
    const { error } = await supabase.from("content_reports").update({ status: s, resolved_at: new Date().toISOString(), resolved_by: (await supabase.auth.getUser()).data.user?.id }).eq("id", id);
    if (error) return toast.error("Ошибка");
    await log(s === "resolved" ? "resolve" : "dismiss", { report_id: id });
    qc.invalidateQueries({ queryKey: ["mod-reports"] });
  }

  const list = (reports.data ?? []).filter((r) => (status === "open" ? r.status === "open" : r.status !== "open"));

  return (
    <>
      <PageHeader title="Модерация" subtitle="Жалобы участниц, действия с контентом и история решений. Кто отправил жалобу, авторам не показывается." />
      <Tabs defaultValue="reports">
        <TabsList><TabsTrigger value="reports">Жалобы</TabsTrigger><TabsTrigger value="restrictions">Ограничения</TabsTrigger><TabsTrigger value="history">История</TabsTrigger></TabsList>
        <TabsContent value="reports" className="mt-4 grid gap-3">
          <div className="flex gap-2">
            <Button size="sm" variant={status === "open" ? "default" : "outline"} onClick={() => setStatus("open")}>Открытые ({(reports.data ?? []).filter((r) => r.status === "open").length})</Button>
            <Button size="sm" variant={status === "closed" ? "default" : "outline"} onClick={() => setStatus("closed")}>Закрытые</Button>
          </div>
          {list.length === 0 && <p className="text-sm text-muted-foreground">Жалоб нет.</p>}
          {list.map((r) => {
            const target = r.comments ?? r.posts;
            const isComment = !!r.comments;
            return (
              <article key={r.id} className="rounded-3xl border border-border bg-card p-5 text-sm shadow-soft">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-blush px-2 py-0.5 font-medium text-primary">{REPORT_REASONS[r.reason as ReportReason]}</span>
                  <span>{isComment ? "Комментарий" : "Пост"}</span><span>· {new Date(r.created_at).toLocaleString("ru-RU")}</span>
                  {r.status !== "open" && <span>· {r.status === "resolved" ? "решено" : "отклонено"}</span>}
                </div>
                {r.note && <p className="mt-2 italic">Пояснение: {r.note}</p>}
                {target ? (
                  <div className="mt-3 rounded-2xl bg-muted px-4 py-3">
                    <p className="text-xs font-semibold">{target.author_name}{target.removed_at && <span className="ml-2 text-destructive">удалено</span>}</p>
                    <p className="mt-1 whitespace-pre-line">{target.body}</p>
                  </div>
                ) : <p className="mt-3 text-muted-foreground">Контент уже удалён автором.</p>}
                {r.status === "open" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {target && !target.removed_at && <Button size="sm" variant="destructive" onClick={async () => {
                      const tbl = isComment ? "comments" : "posts";
                      const { error } = await supabase.from(tbl).update({ removed_at: new Date().toISOString() }).eq("id", target.id);
                      if (error) return toast.error("Ошибка");
                      await log("remove_content", { report_id: r.id, post_id: r.post_id, comment_id: r.comment_id, target_user_id: target.author_id });
                      qc.invalidateQueries(); toast.success("Контент скрыт");
                    }}>Удалить контент</Button>}
                    {target?.author_id && <>
                      <Button size="sm" variant="outline" onClick={() => restrict(target.author_id!, "muted", 7, r.id)}>Запретить публикации на 7 дней</Button>
                      <Button size="sm" variant="outline" onClick={() => restrict(target.author_id!, "suspended", null, r.id)}>Приостановить аккаунт</Button>
                    </>}
                    <Button size="sm" onClick={() => closeReport(r.id, "resolved")}>Решено</Button>
                    <Button size="sm" variant="ghost" onClick={() => closeReport(r.id, "dismissed")}>Отклонить</Button>
                  </div>
                )}
              </article>
            );
          })}
        </TabsContent>
        <TabsContent value="restrictions" className="mt-4 grid gap-2 text-sm">
          {(restrictions.data ?? []).length === 0 && <p className="text-muted-foreground">Активных ограничений нет.</p>}
          {(restrictions.data ?? []).map((x) => (
            <div key={x.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3">
              <span>{x.kind === "suspended" ? "Приостановлен" : "Без публикаций"} · {x.until ? `до ${new Date(x.until).toLocaleDateString("ru-RU")}` : "бессрочно"} · <span className="text-xs text-muted-foreground">{x.user_id.slice(0, 8)}</span></span>
              <Button size="sm" variant="ghost" onClick={async () => {
                await supabase.from("account_restrictions").delete().eq("user_id", x.user_id);
                await log("lift", { target_user_id: x.user_id });
                qc.invalidateQueries({ queryKey: ["mod-restrictions"] });
              }}>Снять</Button>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="history" className="mt-4 grid gap-2 text-sm">
          {(history.data ?? []).length === 0 && <p className="text-muted-foreground">Пока нет действий.</p>}
          {(history.data ?? []).map((h) => (
            <div key={h.id} className="flex justify-between gap-2 rounded-2xl bg-muted px-4 py-2"><span>{ACTION_LABEL[h.action] ?? h.action}{h.note && ` — ${h.note}`}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("ru-RU")}</span></div>
          ))}
        </TabsContent>
      </Tabs>
    </>
  );

  async function restrict(user_id: string, kind: "muted" | "suspended", days: number | null, report_id: string) {
    const until = days ? new Date(Date.now() + days * 86400_000).toISOString() : null;
    const { error } = await supabase.from("account_restrictions").upsert({ user_id, kind, until, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (error) return toast.error("Ошибка");
    await log(kind === "muted" ? "mute" : "suspend", { report_id, target_user_id: user_id });
    qc.invalidateQueries({ queryKey: ["mod-restrictions"] }); toast.success("Ограничение применено");
  }
}
