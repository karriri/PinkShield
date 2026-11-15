import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BookmarkCheck, CalendarHeart, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app-shell";
import { formatDate, splitAppointments, useAppointments } from "@/lib/appointments";
import { ARTICLES } from "@/lib/articles";
import { useProfile } from "@/lib/profile";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Профиль — PINK SHIELD" },
      { name: "description", content: "Ваш псевдоним, визиты и сохранённые материалы в PINK SHIELD." },
      { property: "og:title", content: "Профиль — PINK SHIELD" },
      { property: "og:description", content: "Личное пространство без лишних данных." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile, ready] = useProfile();
  const [appts] = useAppointments();
  const [name, setName] = useState("");
  useEffect(() => { if (ready) setName(profile.name); }, [ready, profile.name]);
  const { upcoming, history } = splitAppointments(appts);
  const saved = ARTICLES.filter((a) => profile.saved.includes(a.id));

  return (
    <>
      <PageHeader title="Профиль" subtitle="Мы не просим лишних личных или медицинских данных. Всё хранится только в этом браузере." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="text-2xl font-semibold text-primary">Настройки</h2>
          <form className="mt-4 grid gap-4" onSubmit={(e) => {
            e.preventDefault(); const n = name.trim();
            if (n.length < 2) { toast.error("Имя должно быть не короче 2 символов"); return; }
            setProfile((p) => ({ ...p, name: n.slice(0, 30) })); toast.success("Сохранено");
          }}>
            <div className="grid gap-2"><Label htmlFor="name">Имя или псевдоним</Label><Input id="name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-2">
              <Label>Язык интерфейса</Label>
              <Select value={profile.language} onValueChange={(v) => { setProfile((p) => ({ ...p, language: v as "ru" | "en" })); if (v === "en") toast("English version is coming soon"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ru">Русский</SelectItem><SelectItem value="en">English (скоро)</SelectItem></SelectContent>
              </Select>
            </div>
            <Button type="submit" className="justify-self-start">Сохранить</Button>
          </form>
        </section>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary"><BookmarkCheck className="h-5 w-5 text-rose" /> Сохранённые материалы</h2>
          {saved.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Сохраняйте статьи в <Link to="/knowledge" className="underline">базе знаний</Link>, чтобы быстро к ним возвращаться.</p> :
            <ul className="mt-3 grid gap-2">{saved.map((a) => <li key={a.id}><Link to="/knowledge" hash={a.id} className="block rounded-2xl bg-muted px-4 py-3 text-sm hover:bg-blush">{a.title}</Link></li>)}</ul>}
        </section>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary"><CalendarHeart className="h-5 w-5 text-rose" /> Предстоящие визиты</h2>
          {upcoming.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Нет запланированных визитов.</p> :
            <ul className="mt-3 grid gap-2 text-sm">{upcoming.map((a) => <li key={a.id} className="flex justify-between gap-2 rounded-2xl bg-muted px-4 py-3"><span>{a.type}</span><span className="text-muted-foreground">{formatDate(a)}</span></li>)}</ul>}
        </section>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary"><History className="h-5 w-5 text-rose" /> История обследований</h2>
          {history.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">История пока пуста.</p> :
            <ul className="mt-3 grid gap-2 text-sm">{history.map((a) => <li key={a.id} className="flex justify-between gap-2 rounded-2xl bg-muted px-4 py-3"><span>{a.type}</span><span className="text-muted-foreground">{formatDate(a)}</span></li>)}</ul>}
          <Button variant="link" className="mt-2 px-0" asChild><Link to="/calendar">Управлять в календаре</Link></Button>
        </section>
      </div>
    </>
  );
}
