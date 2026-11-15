import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CalendarHeart, Heart, Lightbulb, MessageCircle, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/app-shell";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { formatDate, splitAppointments, useAppointments } from "@/lib/appointments";
import { usePosts, timeAgo } from "@/lib/community";
import { logActivity, useProfile } from "@/lib/profile";
import { uid } from "@/lib/store";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PINK SHIELD — Главная" },
      { name: "description", content: "Ваш спутник в заботе о здоровье груди: ближайшие обследования, AI-помощник и поддержка сообщества." },
      { property: "og:title", content: "PINK SHIELD — Главная" },
      { property: "og:description", content: "Забота о здоровье начинается с маленьких шагов." },
    ],
  }),
  component: Home,
});

function Home() {
  const [appts, setAppts] = useAppointments();
  const [posts] = usePosts();
  const [profile, setProfile] = useProfile();
  const [open, setOpen] = useState(false);
  const { upcoming } = splitAppointments(appts);
  const next = upcoming[0];

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-hero p-8 shadow-soft sm:p-10">
        <div className="relative z-10 max-w-md lg:max-w-lg">
          <p className="text-sm font-medium text-rose">Здравствуйте, {profile.name}</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-primary sm:text-5xl">Добро пожаловать в PINK SHIELD</h1>
          <p className="mt-3 text-muted-foreground">Забота о здоровье начинается с маленьких шагов.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setOpen(true)}><Plus /> Добавить обследование</Button>
            <Button size="lg" variant="outline" asChild><Link to="/assistant"><Sparkles /> Разобрать заключение</Link></Button>
          </div>
        </div>
        <img src={hero} alt="Иллюстрация: женщина с розовой лентой" width={1024} height={1024}
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-auto md:block md:opacity-40 xl:opacity-100" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl bg-plum p-6 text-primary-foreground shadow-soft lg:col-span-2">
          <div className="flex items-center gap-2 text-sm opacity-80"><CalendarHeart className="h-4 w-4" /> Следующий визит</div>
          {next ? (
            <>
              <h2 className="mt-3 text-3xl font-semibold">{next.type}</h2>
              <p className="mt-1 opacity-90">{formatDate(next)}, {next.time}{next.place && ` · ${next.place}`}</p>
              {next.notes && <p className="mt-3 text-sm opacity-80">{next.notes}</p>}
            </>
          ) : (
            <p className="mt-3 opacity-90">Пока нет запланированных визитов. Добавьте обследование, о котором договорились с врачом.</p>
          )}
          <Button variant="secondary" className="mt-5" asChild><Link to="/calendar">Открыть календарь <ArrowRight /></Link></Button>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-blush text-primary"><Sparkles className="h-5 w-5" /></div>
          <h2 className="mt-4 text-2xl font-semibold text-primary">AI-помощник</h2>
          <p className="mt-2 text-sm text-muted-foreground">Объясним термины из заключения простыми словами и поможем подготовить вопросы врачу.</p>
          <Button variant="link" className="mt-2 px-0" asChild><Link to="/assistant">Попробовать <ArrowRight /></Link></Button>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-primary">Обсуждения в сообществе</h2>
            <DemoBadge>Демо-контент</DemoBadge>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {posts.slice(0, 3).map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{p.author}</span>· {p.category} · {timeAgo(p.at)}</div>
                <p className="mt-1 line-clamp-2 text-sm">{p.text}</p>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.likes}</span><span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments.length}</span></div>
              </li>
            ))}
          </ul>
          <Button variant="link" className="px-0" asChild><Link to="/community">Все обсуждения <ArrowRight /></Link></Button>
        </section>

        <div className="grid gap-6">
          <section className="rounded-3xl bg-blush p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Lightbulb className="h-4 w-4" /> Полезно знать</div>
            <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">Большинство уплотнений в груди оказываются доброкачественными. Но любое новое изменение стоит показать врачу — только он может его оценить.</p>
            <a className="mt-2 inline-block text-xs text-muted-foreground underline" href="https://www.cancer.org/cancer/types/breast-cancer.html" target="_blank" rel="noreferrer">Источник: American Cancer Society</a>
          </section>
          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-xl font-semibold text-primary">Недавние действия</h2>
            {profile.activity.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Здесь появятся ваши последние шаги в приложении.</p>
            ) : (
              <ul className="mt-2 grid gap-2 text-sm">
                {profile.activity.slice(0, 4).map((a, i) => <li key={i} className="flex justify-between gap-2"><span>{a.text}</span><span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>

      <AppointmentDialog open={open} onOpenChange={setOpen} onSave={(d) => {
        setAppts((l) => [...l, { ...d, id: uid(), completed: false }]);
        logActivity(setProfile, `Добавлено: ${d.type}`);
      }} />
    </div>
  );
}
