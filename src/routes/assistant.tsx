import { createFileRoute, Link } from "@tanstack/react-router";
import { CERTAINTY_NOTE, REC_KIND_LABEL, REC_KINDS } from "@/lib/report-safety";
import { Navigator } from "@/components/navigator";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, BookOpen, FileText, HelpCircle, Loader2, Quote, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, DemoBadge } from "@/components/app-shell";
import { DEMO_REPORTS } from "@/lib/demo-reports";
import type { Explanation } from "@/lib/explanation";
import { explainReport } from "@/lib/report.functions";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI-помощник по заключениям — PINK SHIELD" },
      { name: "description", content: "Объясняем медицинские термины из заключений УЗИ и маммографии простым языком и помогаем подготовить вопросы врачу." },
      { property: "og:title", content: "AI-помощник по заключениям — PINK SHIELD" },
      { property: "og:description", content: "Понятные объяснения терминов и BI-RADS. Не ставит диагноз." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

const DISCLAIMER = "AI-помощник помогает разобраться в медицинских терминах, но не ставит диагноз и не заменяет консультацию врача.";

function AssistantPage() {
  // Report text and results live only in memory — never saved to the browser.
  const [text, setText] = useState("");
  const [demoId, setDemoId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const explain = useServerFn(explainReport);

  const demo = DEMO_REPORTS.find((d) => d.id === demoId && d.text === text);

  function pickDemo(id: string) {
    const d = DEMO_REPORTS.find((x) => x.id === id)!;
    setDemoId(id); setText(d.text); setResult(null); setError(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".txt")) { toast.error("Пока поддерживаются только файлы .txt"); return; }
    if (f.size > 64_000) { toast.error("Файл слишком большой"); return; }
    f.text().then((t) => { setText(t.slice(0, 8000)); setDemoId(null); setResult(null); });
  }

  async function submit() {
    setError(null); setResult(null);
    if (demo) { setResult(demo.explanation); return; }
    if (text.trim().length < 20) { setError("Вставьте текст заключения (минимум 20 символов)."); return; }
    if (!consent) { setError("Подтвердите согласие на отправку текста AI-сервису."); return; }
    setLoading(true);
    try {
      const r = await explain({ data: { text } });
      if (r.ok) { setResult(r.result); }
      else setError(r.error);
    } catch {
      setError("Не удалось получить объяснение. Попробуйте ещё раз.");
    } finally { setLoading(false); }
  }

  return (
    <>
      <PageHeader title="AI-помощник" subtitle="Вставьте текст заключения — мы объясним термины простыми словами и подскажем, что спросить у врача." />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose/40 bg-blush p-4 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="font-medium">{DISCLAIMER}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <Textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={10} maxLength={8000}
            placeholder="Вставьте сюда текст заключения УЗИ или маммографии. Перед отправкой удалите ФИО, даты рождения и другие личные данные."
            className="min-h-56 resize-y rounded-2xl bg-cream/40" aria-label="Текст заключения" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{text.length} / 8000</span>
            <span>Поддерживается: вставка текста и файлы .txt. PDF и фото — скоро.</span>
          </div>

          {!demo && (
            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-muted p-3 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>Я понимаю, что текст будет отправлен внешнему AI-сервису для объяснения. Я удалила из него имя и другие личные данные. Текст не сохраняется в приложении.</span>
            </label>
          )}
          {demo && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><DemoBadge /> Подготовленное объяснение, без отправки в AI.</p>}

          {error && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="lg" onClick={submit} disabled={loading || !text.trim() || (!demo && !consent)}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Объяснить заключение
            </Button>
            <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Загрузить .txt</Button>
            <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={onFile} />
            {text && <Button size="lg" variant="ghost" onClick={() => { setText(""); setResult(null); setDemoId(null); }}>Очистить</Button>}
          </div>
        </section>

        <aside className="grid content-start gap-3">
          <p className="text-sm font-semibold text-primary">Попробуйте на демо-примере</p>
          {DEMO_REPORTS.map((d) => (
            <button key={d.id} onClick={() => pickDemo(d.id)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-colors hover:bg-blush ${demoId === d.id ? "border-primary bg-blush" : "border-border bg-card"}`}>
              <FileText className="h-5 w-5 shrink-0 text-rose" />
              <span className="flex-1"><span className="block font-medium">{d.title}</span><span className="text-xs text-muted-foreground">Вымышленный пример</span></span>
            </button>
          ))}
          <div className="rounded-2xl bg-warning p-4 text-sm text-warning-foreground">
            Если вы заметили новое уплотнение, выделения из соска, изменения кожи или формы груди — обратитесь к врачу, не дожидаясь планового визита.
          </div>
        </aside>
      </div>

      {result && <ResultView r={result} />}

      <Navigator />
    </>
  );
}

function Section({ icon: Icon, title, label, children }: { icon: typeof Sparkles; title: string; label?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-5 w-5 text-rose" /><h2 className="text-2xl font-semibold text-primary">{title}</h2>
        {label && <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>}
      </div>
      <div className="mt-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function ResultView({ r }: { r: Explanation }) {
  return (
    <div className="mt-8 grid gap-4">
      <div className="flex items-center gap-2">
        {r.source === "demo" ? <DemoBadge /> : <DemoBadge>Объяснение сгенерировано AI</DemoBadge>}
        <span className="text-xs text-muted-foreground">Проверено: термины, BI-RADS и рекомендации взяты только из вашего текста.</span>
      </div>
      {r.personalConcern && (
        <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-warning p-4 text-sm text-warning-foreground">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Похоже, вы описываете новое изменение, которое заметили сами. Покажите его врачу, не дожидаясь планового обследования: прошлое нормальное заключение не исключает новых изменений, а приложение не может их оценить.</p>
        </div>
      )}
      <Section icon={FileText} title="Что указано в заключении" label="Из исходного текста">
        <p><span className="text-muted-foreground">Вид обследования:</span> {r.examType ?? "в тексте не указан"}</p>
        {r.findings && r.findings.length > 0 ? (
          <ul className="mt-2 grid gap-1">{r.findings.map((f) => <li key={f} className="border-l-4 border-border bg-muted/60 px-3 py-1 italic">«{f}»</li>)}</ul>
        ) : <p className="mt-2 text-muted-foreground">Отдельные находки не выделены.</p>}
        <div className="mt-3">
          {r.birads ? (
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-plum font-display text-2xl text-primary-foreground">{r.birads.category}</span>
              <div><p className="font-semibold">BI-RADS {r.birads.category}</p><p>{r.birads.meaning}</p><p className="mt-1 text-xs text-muted-foreground">Общее описание категории. Что она значит именно для вас, объяснит врач. <Link to="/knowledge" className="underline">Подробнее о BI-RADS</Link></p></div>
            </div>
          ) : <p className="text-muted-foreground">BI-RADS: в тексте не указано.</p>}
        </div>
      </Section>
      <Section icon={Quote} title="Рекомендации врача" label="Из исходного текста">
        {r.recommendations.length === 0 ? <p className="text-muted-foreground">В тексте заключения рекомендации не найдены.</p> : (
          <div className="grid gap-4">{REC_KINDS.filter((k) => r.recommendations.some((q) => q.kind === k)).map((k) => (
            <div key={k}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{REC_KIND_LABEL[k]}</p>
              <ul className="grid gap-2">{r.recommendations.filter((q) => q.kind === k).map((q) => (
                <li key={q.text} className="border-l-4 border-rose bg-cream/60 px-4 py-2">
                  <span className="italic">«{q.text}»</span>
                  {q.passage && q.passage !== q.text && <span className="mt-1 block text-xs text-muted-foreground">Фрагмент заключения: «{q.passage}»</span>}
                  {q.certainty && CERTAINTY_NOTE[q.certainty] && <span className="mt-1 block text-xs font-medium text-secondary-foreground">{CERTAINTY_NOTE[q.certainty]}</span>}
                  {q.kind === "diet" && <span className="mt-1 block text-xs text-muted-foreground">Это рекомендация по питанию из заключения, а не лечение. Подробности уточните у врача.</span>}
                </li>
              ))}</ul>
            </div>
          ))}</div>
        )}
      </Section>
      <Section icon={Sparkles} title="Объяснение простыми словами" label={r.source === "ai" ? "Сгенерировано AI, не указание врача" : "Демо-объяснение"}>
        <p>{r.summary}</p>
        {r.recommendations.some((q) => q.explanation) && (
          <ul className="mt-3 grid gap-2">{r.recommendations.filter((q) => q.explanation).map((q) => <li key={q.text} className="rounded-2xl bg-muted p-3"><span className="font-semibold text-primary">«{q.text}»</span> — {q.explanation}</li>)}</ul>
        )}
        {r.terms.length > 0 && (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">{r.terms.map((t) => (
            <div key={t.term} className="rounded-2xl bg-muted p-3"><dt className="font-semibold text-primary">{t.term}</dt><dd className="mt-1 text-muted-foreground">{t.explanation}</dd></div>
          ))}</dl>
        )}
      </Section>
      <Section icon={HelpCircle} title="Что можно уточнить у врача" label="Подсказки, не медицинский совет">
        {r.uncertainties && r.uncertainties.length > 0 && (
          <div className="mb-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Что неясно или не указано</p>
            <ul className="mt-1 grid list-disc gap-1 pl-5">{r.uncertainties.map((u) => <li key={u}>{u}</li>)}</ul></div>
        )}
        <ol className="grid list-decimal gap-1 pl-5">{r.questions.map((q) => <li key={q}>{q}</li>)}</ol>
      </Section>
      <p className="text-center text-xs text-muted-foreground">{DISCLAIMER}</p>
    </div>
  );
}
