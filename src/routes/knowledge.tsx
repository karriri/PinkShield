import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell";
import { ARTICLES } from "@/lib/articles";
import { useSavedArticles, useToggleSaved } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "База знаний — PINK SHIELD" },
      { name: "description", content: "Простые статьи о здоровье молочных желёз: маммография, УЗИ, BI-RADS, факторы риска и мифы." },
      { property: "og:title", content: "База знаний — PINK SHIELD" },
      { property: "og:description", content: "Понятная информация о здоровье груди со ссылками на источники." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { userId } = useAuth();
  const { data: savedIds = [] } = useSavedArticles();
  const toggle = useToggleSaved();
  const [openId, setOpenId] = useState<string | null>(ARTICLES[0]?.id ?? null);
  const toggleSave = (id: string) => (userId ? toggle(id, savedIds.includes(id)) : toast("Войдите, чтобы сохранять статьи"));

  return (
    <>
      <PageHeader title="База знаний" subtitle="Общая образовательная информация простыми словами." />
      <div className="mb-6 flex gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Info className="h-5 w-5 shrink-0 text-rose" />
        <p>Это общая информация, а не индивидуальная медицинская рекомендация. Самообследование не заменяет обследование у специалиста.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ARTICLES.map((a) => {
          const saved = savedIds.includes(a.id);
          const open = openId === a.id;
          return (
            <article key={a.id} id={a.id} className={`rounded-3xl border bg-card p-6 shadow-soft ${open ? "border-rose md:col-span-2" : "border-border"}`}>
              <div className="flex items-start gap-3">
                <h2 className="flex-1 text-2xl font-semibold text-primary">{a.title}</h2>
                <Button size="icon" variant="ghost" aria-label={saved ? "Убрать из сохранённых" : "Сохранить"} onClick={() => toggleSave(a.id)}>
                  {saved ? <BookmarkCheck className="text-rose" /> : <Bookmark />}
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{a.lead}</p>
              {open && (
                <>
                  <ul className="mt-4 grid list-disc gap-2 pl-5 text-sm leading-relaxed">{a.body.map((b) => <li key={b}>{b}</li>)}</ul>
                  <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <p className="font-semibold">Источники:</p>
                    {a.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 underline">{s.name} <ExternalLink className="h-3 w-3" /></a>)}
                  </div>
                </>
              )}
              <Button variant="link" className="mt-2 px-0" onClick={() => setOpenId(open ? null : a.id)}>{open ? "Свернуть" : "Читать"}</Button>
            </article>
          );
        })}
      </div>
    </>
  );
}
