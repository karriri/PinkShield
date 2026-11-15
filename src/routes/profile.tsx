import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, BookmarkCheck, CalendarHeart, History, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app-shell";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { MigrateCard } from "@/components/migrate-card";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, groupAppointments, useAppointments } from "@/lib/appointments";
import { ARTICLES } from "@/lib/articles";
import { useSavedArticles } from "@/lib/profile";
import { useAuth, useMyProfile } from "@/lib/auth";
import { useBlocks, useCommunityActions, usePosts } from "@/lib/community";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Профиль — PINK SHIELD" },
      { name: "description", content: "Ваш псевдоним, визиты, сохранённые материалы и настройки безопасности в PINK SHIELD." },
      { property: "og:title", content: "Профиль — PINK SHIELD" },
      { property: "og:description", content: "Личное пространство без лишних данных." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const card = "rounded-3xl border border-border bg-card p-6 shadow-soft";
const h2 = "flex items-center gap-2 text-2xl font-semibold text-primary";

function ProfilePage() {
  const { userId, ready } = useAuth();
  const { data: profile } = useMyProfile();
  const { data: appts = [] } = useAppointments();
  const { data: savedIds = [] } = useSavedArticles();
  const { data: blocks = [] } = useBlocks();
  const { data: posts = [] } = usePosts();
  const act = useCommunityActions();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  useEffect(() => { if (profile) setName(profile.pseudonym); }, [profile]);
  if (ready && !userId) return (<><PageHeader title="Профиль" /><SignInPrompt text="Профиль, визиты и сохранённые материалы привязаны к вашему аккаунту." /></>);

  const g = groupAppointments(appts);
  const history = [...g.completed, ...g.missed, ...g.cancelled];
  const saved = ARTICLES.filter((a) => savedIds.includes(a.id));
  const mine = posts.filter((p) => p.author_id === userId);
  const myComments = posts.flatMap((p) => p.comments).filter((c) => c.author_id === userId).length;

  async function save(patch: { pseudonym?: string; language?: string }) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId!);
    qc.invalidateQueries();
    if (error) toast.error("Не удалось сохранить"); else toast.success("Сохранено");
  }

  return (
    <>
      <PageHeader title="Профиль" subtitle="Мы не просим лишних личных или медицинских данных. В сообществе виден только ваш псевдоним." />
      <div className="mb-6"><MigrateCard /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className={h2}>Настройки</h2>
          <form className="mt-4 grid gap-4" onSubmit={(e) => {
            e.preventDefault(); const n = name.trim();
            if (n.length < 2) { toast.error("Псевдоним — не короче 2 символов"); return; }
            save({ pseudonym: n.slice(0, 40) });
          }}>
            <div className="grid gap-2"><Label htmlFor="name">Псевдоним</Label><Input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              <p className="text-xs text-muted-foreground">Не используйте настоящее имя. Псевдоним обновится и в ваших прошлых постах.</p></div>
            <div className="grid gap-2">
              <Label>Язык интерфейса</Label>
              <Select value={profile?.language ?? "ru"} onValueChange={(v) => { save({ language: v }); if (v === "en") toast("English version is coming soon"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ru">Русский</SelectItem><SelectItem value="en">English (скоро)</SelectItem></SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Часовой пояс для напоминаний: {profile?.timezone}</p>
            <Button type="submit" className="justify-self-start">Сохранить</Button>
          </form>
        </section>
        <section className={card}>
          <h2 className={h2}><BookmarkCheck className="h-5 w-5 text-rose" /> Сохранённые материалы</h2>
          {saved.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Сохраняйте статьи в <Link to="/knowledge" className="underline">базе знаний</Link>, чтобы быстро к ним возвращаться.</p> :
            <ul className="mt-3 grid gap-2">{saved.map((a) => <li key={a.id}><Link to="/knowledge" hash={a.id} className="block rounded-2xl bg-muted px-4 py-3 text-sm hover:bg-blush">{a.title}</Link></li>)}</ul>}
        </section>
        <section className={card}>
          <h2 className={h2}><CalendarHeart className="h-5 w-5 text-rose" /> Предстоящие визиты</h2>
          {g.upcoming.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Нет запланированных визитов.</p> :
            <ul className="mt-3 grid gap-2 text-sm">{g.upcoming.map((a) => <li key={a.id} className="flex justify-between gap-2 rounded-2xl bg-muted px-4 py-3"><span>{a.type}</span><span className="text-muted-foreground">{formatDate(a)}</span></li>)}</ul>}
        </section>
        <section className={card}>
          <h2 className={h2}><History className="h-5 w-5 text-rose" /> История обследований</h2>
          <p className="mt-1 text-xs text-muted-foreground">Пройдено: {g.completed.length} · пропущено: {g.missed.length} · отменено: {g.cancelled.length}</p>
          {history.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">История пока пуста.</p> :
            <ul className="mt-3 grid gap-2 text-sm">{history.slice(0, 8).map((a) => <li key={a.id} className="flex justify-between gap-2 rounded-2xl bg-muted px-4 py-3"><span>{a.type}</span><span className="text-muted-foreground">{formatDate(a)}</span></li>)}</ul>}
          <Button variant="link" className="mt-2 px-0" asChild><Link to="/calendar">Вся история в календаре</Link></Button>
        </section>
        <section className={card}>
          <h2 className={h2}><MessagesSquare className="h-5 w-5 text-rose" /> Моя активность</h2>
          <p className="mt-2 text-sm text-muted-foreground">Постов: {mine.length} · комментариев: {myComments}</p>
          <ul className="mt-3 grid gap-2 text-sm">{mine.slice(0, 5).map((p) => <li key={p.id} className="line-clamp-2 rounded-2xl bg-muted px-4 py-3">{p.body}</li>)}</ul>
          <Button variant="link" className="mt-2 px-0" asChild><Link to="/community">Открыть сообщество</Link></Button>
        </section>
        <section className={card}>
          <h2 className={h2}><Ban className="h-5 w-5 text-rose" /> Заблокированные</h2>
          {blocks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Вы никого не блокировали.</p> :
            <ul className="mt-3 grid gap-2 text-sm">{blocks.map((b) => (
              <li key={b.blocked_id} className="flex items-center justify-between gap-2 rounded-2xl bg-muted px-4 py-2"><span>{b.blocked_name || "Участница"}</span>
                <Button size="sm" variant="ghost" onClick={() => act.unblock(b.blocked_id).then(() => toast.success("Разблокировано"))}>Разблокировать</Button></li>
            ))}</ul>}
          <p className="mt-3 text-xs text-muted-foreground">Заблокированная участница не узнает об этом. Её посты и комментарии скрыты для вас, а она не может отвечать на ваши публикации.</p>
        </section>
      </div>
    </>
  );
}
