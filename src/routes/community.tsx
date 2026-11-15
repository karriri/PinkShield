import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Flag, Heart, MessageCircle, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, DemoBadge } from "@/components/app-shell";
import { CATEGORIES, timeAgo, usePosts, type Category, type Post } from "@/lib/community";
import { logActivity, useProfile } from "@/lib/profile";
import { uid } from "@/lib/store";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Сообщество — PINK SHIELD" },
      { name: "description", content: "Тёплое пространство, где женщины делятся опытом, задают вопросы и поддерживают друг друга." },
      { property: "og:title", content: "Сообщество — PINK SHIELD" },
      { property: "og:description", content: "Вы не одни. Делитесь опытом и находите поддержку." },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const [posts, setPosts] = usePosts();
  const [profile, setProfile] = useProfile();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [text, setText] = useState("");
  const [cat, setCat] = useState<Category>("Мой опыт");

  const visible = posts.filter((p) => !p.reported && (filter === "all" || p.category === filter));
  const update = (id: string, fn: (p: Post) => Post) => setPosts((l) => l.map((p) => (p.id === id ? fn(p) : p)));

  function publish() {
    const t = text.trim();
    if (t.length < 5) { toast.error("Напишите хотя бы пару слов"); return; }
    setPosts((l) => [{ id: uid(), author: profile.name || "Участница", category: cat, text: t.slice(0, 1000), at: Date.now(), likes: 0, liked: false, comments: [], reported: false }, ...l]);
    setText(""); logActivity(setProfile, "Опубликован пост в сообществе"); toast.success("Пост опубликован");
  }

  return (
    <>
      <PageHeader title="Сообщество" subtitle="Место, где можно поделиться опытом, задать вопрос и найти поддержку." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-4">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Чем хотите поделиться?" className="rounded-2xl" aria-label="Текст поста" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Select value={cat} onValueChange={(v) => setCat(v as Category)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Публикуется под псевдонимом «{profile.name}»</span>
              <Button className="ml-auto" onClick={publish}><Send /> Опубликовать</Button>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button key={c} onClick={() => setFilter(c)} className={`rounded-full border px-3 py-1 text-sm transition-colors ${filter === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-blush"}`}>{c === "all" ? "Все" : c}</button>
            ))}
          </div>

          {visible.length === 0 && <p className="rounded-3xl bg-blush p-8 text-center text-muted-foreground">В этой категории пока нет постов. Станьте первой!</p>}
          {visible.map((p) => <PostCard key={p.id} p={p} me={profile.name} update={update} />)}
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-3xl bg-blush p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-primary"><ShieldAlert className="h-4 w-4" /> Правила бережного общения</p>
            <ul className="mt-2 grid list-disc gap-1 pl-4 text-secondary-foreground">
              <li>Поддерживайте, а не осуждайте.</li>
              <li>Не публикуйте ФИО, телефоны и медицинские документы.</li>
              <li>Опыт других — не замена совету врача.</li>
              <li>Пожаловаться на пост можно кнопкой с флажком.</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
            <DemoBadge>Демо-контент</DemoBadge>
            <p className="mt-2">Посты от других участниц — вымышленные примеры. Ваши публикации сохраняются только в этом браузере и не видны другим.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function PostCard({ p, me, update }: { p: Post; me: string; update: (id: string, fn: (p: Post) => Post) => void }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState("");
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-blush font-display text-lg text-primary">{p.author[0]}</span>
        <div className="min-w-0 flex-1"><p className="font-semibold">{p.author}</p><p className="text-xs text-muted-foreground">{p.category} · {timeAgo(p.at)}</p></div>
        {p.demo && <DemoBadge />}
      </header>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{p.text}</p>
      <div className="mt-4 flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => update(p.id, (x) => ({ ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }))} aria-pressed={p.liked}>
          <Heart className={p.liked ? "fill-rose text-rose" : ""} /> {p.likes}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}><MessageCircle /> {p.comments.length}</Button>
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => {
          if (confirm("Пожаловаться на этот пост? Он будет скрыт из вашей ленты.")) { update(p.id, (x) => ({ ...x, reported: true })); toast("Спасибо! Пост скрыт."); }
        }}><Flag /> Пожаловаться</Button>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3">
          {p.comments.map((cm) => (
            <div key={cm.id} className="rounded-2xl bg-muted px-3 py-2 text-sm"><span className="font-semibold">{cm.author}</span> <span className="text-xs text-muted-foreground">· {timeAgo(cm.at)}</span><p>{cm.text}</p></div>
          ))}
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault(); const t = c.trim(); if (!t) return;
            update(p.id, (x) => ({ ...x, comments: [...x.comments, { id: uid(), author: me || "Участница", text: t.slice(0, 500), at: Date.now() }] })); setC("");
          }}>
            <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="Написать тёплый комментарий…" maxLength={500} className="rounded-full" />
            <Button type="submit" size="icon" aria-label="Отправить"><Send /></Button>
          </form>
        </div>
      )}
    </article>
  );
}
