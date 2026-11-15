import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Compass, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuidance } from "@/lib/guidance";
import { EMPTY_ANSWERS, navigate, type NavAnswers, type NavResult } from "@/lib/navigator";
import { simplifyGuidance } from "@/lib/navigator.functions";

type Q = { key: keyof NavAnswers; q: string; why: string; options?: { v: string; label: string }[] };
const YN = [{ v: "yes", label: "Да" }, { v: "no", label: "Нет" }];
const QUESTIONS: Q[] = [
  { key: "age", q: "Сколько вам лет?", why: "Программа скрининга в Казахстане зависит от возраста." },
  { key: "newChange", q: "Замечали ли вы в последнее время новое или необычное изменение в груди (уплотнение, выделения, изменение кожи или соска)?", why: "Изменения оценивают отдельно от планового скрининга.", options: YN },
  { key: "pastExam", q: "Проходили ли вы раньше маммографию или УЗИ груди?", why: "Помогает понять, что уже известно о вашей ситуации.", options: YN },
  { key: "lastExam", q: "Когда было последнее обследование (примерно)?", why: "Только для контекста — дату мы не рассчитываем.", options: [{ v: "lt1", label: "Меньше года" }, { v: "1to2", label: "1–2 года" }, { v: "gt2", label: "Больше 2 лет" }, { v: "never", label: "Не проходила" }] },
  { key: "underFollowUp", q: "Вы уже наблюдаетесь у врача по поводу груди: лечились от рака груди, есть заболевание под наблюдением, были отклонения в результатах или выявлен высокий риск?", why: "В этом случае ваш план определяет лечащий врач, а не общая программа.", options: YN },
  { key: "familyHistory", q: "Был ли рак груди или яичников у близких родственников?", why: "Это повод обсудить с врачом индивидуальный план.", options: YN },
  { key: "highRisk", q: "Вам говорили о мутации генов (например, BRCA) или о повышенном риске?", why: "Это повод обсудить с врачом индивидуальный план.", options: YN },
];

export function Navigator() {
  const [a, setA] = useState<NavAnswers>(EMPTY_ANSWERS);
  const [results, setResults] = useState<NavResult[] | null>(null);
  const guidance = useGuidance();
  const set = (k: keyof NavAnswers, v: unknown) => { setA((p) => ({ ...p, [k]: v })); setResults(null); };

  return (
    <section className="mt-12 rounded-3xl border border-border bg-card p-6 shadow-soft" aria-labelledby="nav-title">
      <div className="flex items-center gap-2"><Compass className="h-6 w-6 text-rose" /><h2 id="nav-title" className="text-3xl font-semibold text-primary">Персональный навигатор здоровья груди</h2></div>
      <p className="mt-2 text-sm text-muted-foreground">Ответьте на любые вопросы — каждый можно пропустить. Ответы не сохраняются и никуда не отправляются. Подсказки основаны на утверждённых источниках (Минздрав РК, ВОЗ, NCI), а не на AI.</p>
      <ol className="mt-5 grid gap-4">
        {QUESTIONS.map((q, i) => (
          <li key={q.key} className="rounded-2xl bg-muted/60 p-4">
            <p className="font-medium">{i + 1}. {q.q}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Зачем спрашиваем: {q.why}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.key === "age" ? (
                <Input type="number" min={18} max={110} inputMode="numeric" className="w-28 bg-card" aria-label="Возраст"
                  value={a.age ?? ""} onChange={(e) => set("age", e.target.value ? Math.max(0, Math.min(120, Number(e.target.value))) : null)} />
              ) : q.options!.map((o) => (
                <Button key={o.v} size="sm" variant={a[q.key] === o.v ? "default" : "outline"} onClick={() => set(q.key, o.v)}>{o.label}</Button>
              ))}
              <Button size="sm" variant={a[q.key] === null ? "secondary" : "ghost"} onClick={() => set(q.key, null)}>Не знаю / пропустить</Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => setResults(navigate(a, guidance.data ?? []))} disabled={!guidance.data}>
          {guidance.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Показать подсказку
        </Button>
        <Button variant="ghost" onClick={() => { setA(EMPTY_ANSWERS); setResults(null); }}>Очистить ответы</Button>
      </div>
      {guidance.error && <p className="mt-2 text-sm text-destructive">Не удалось загрузить справочные материалы. Попробуйте позже.</p>}
      {results && <div className="mt-6 grid gap-4">{results.map((r) => <ResultCard key={r.type} r={r} />)}</div>}
    </section>
  );
}

function ResultCard({ r }: { r: NavResult }) {
  const guidance = useGuidance();
  const stmts = r.guidanceKeys.map((k) => guidance.data?.find((s) => s.key === k)).filter((s) => !!s);
  return (
    <article className={`rounded-2xl border p-5 ${r.type === "symptom" ? "border-rose bg-blush" : "border-border bg-cream/50"}`}>
      <h3 className="text-xl font-semibold text-primary">{r.title}</h3>
      <dl className="mt-3 grid gap-3 text-sm">
        {r.reported.length > 0 && <div><dt className="font-semibold">Что вы указали</dt><dd>{r.reported.join(" ")}</dd></div>}
        <div><dt className="font-semibold">Справочная информация</dt>
          <dd className="grid gap-2">{stmts.map((s) => <Statement key={s.key} text={s.text} source={s.source} />)}</dd></div>
        <div><dt className="font-semibold">Возможный следующий шаг</dt><dd>{r.nextStep}</dd></div>
        <div><dt className="font-semibold">Почему</dt><dd>{r.why}</dd></div>
        <div><dt className="font-semibold">Ограничения</dt><dd className="text-muted-foreground">{r.limits}</dd></div>
      </dl>
    </article>
  );
}

function Statement({ text, source }: { text: string; source: { organization: string; title: string; url: string; country: string; checked_on: string } | null }) {
  const simplify = useServerFn(simplifyGuidance);
  const [simple, setSimple] = useState<{ text: string; simplified: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl bg-card p-3">
      <p>{text}</p>
      {simple && (simple.simplified
        ? <p className="mt-2 rounded-lg bg-muted p-2"><span className="text-[11px] font-semibold uppercase text-muted-foreground">Проще (AI, проверено на соответствие тексту выше)</span><br />{simple.text}</p>
        : <p className="mt-2 text-xs text-muted-foreground">Упрощённый пересказ не прошёл проверку, поэтому показан только утверждённый текст.</p>)}
      {source && (
        <p className="mt-2 text-xs text-muted-foreground">
          Источник: {source.organization}{source.country === "KZ" ? "" : " (международный)"} — <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">{source.title}<ExternalLink className="h-3 w-3" /></a>. Проверено: {new Date(source.checked_on).toLocaleDateString("ru-RU")}.
        </p>
      )}
      {!simple && (
        <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" disabled={busy}
          onClick={async () => { setBusy(true); try { setSimple(await simplify({ data: { statement: text } })); } catch { setSimple({ text, simplified: false }); } finally { setBusy(false); } }}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}Объяснить проще
        </Button>
      )}
    </div>
  );
}
