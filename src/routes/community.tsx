import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, Flag, Heart, MessageCircle, MoreHorizontal, Pencil, Reply, Send, ShieldAlert, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, DemoBadge } from "@/components/app-shell";
import { ReportDialog } from "@/components/report-dialog";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, COMMUNITY_RULES, timeAgo, useCommunityActions, useMyLikes, usePosts, type Category, type Comment, type Post } from "@/lib/community";
import { useAuth, useMyProfile, useMyRestriction } from "@/lib/auth";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Сообщество — PINK SHIELD" },
      { name: "description", content: "Тёплое пространство, где женщины делятся опытом, задают вопросы и поддерживают друг друга." },
      { property: "og:title", content: "Сообщество — PINK SHIELD" },
      { property: "og:description", content: "Вы не одни. Делитесь опытом и находите поддержку." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityPage,
});

type Target = { post_id?: string; comment_id?: string } | null;

function CommunityPage() {
  const { userId } = useAuth();
  const { data: profile } = useMyProfile();
  const { data: restriction } = useMyRestriction();
  const { data: posts = [], isLoading } = usePosts();
  const act = useCommunityActions();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Category | "all" | "mine">("all");
  const [text, setText] = useState("");
  const [cat, setCat] = useState<Category>("Мой опыт");
  const [agree, setAgree] = useState(false);
  const [report, setReport] = useState<Target>(null);

  const visible = posts.filter((p) => (p.removed_at === null || p.author_id === userId) &&
    (filter === "all" || (filter === "mine" ? p.author_id === userId : p.category === filter)));
  const needsRules = !!profile && !profile.rules_accepted_at;

  async function publish() {
    const t = text.trim();
    if (t.length < 5) return toast.error("Напишите хотя бы пару слов");
    if (needsRules && !agree) return toast.error("Пожалуйста, подтвердите правила сообщества");
    try {
      if (needsRules) { await supabase.from("profiles").update({ rules_accepted_at: new Date().toISOString() }).eq("id", profile!.id); qc.invalidateQueries({ queryKey: ["profile"] }); }
      await act.createPost(cat, t.slice(0, 2000)); setText(""); toast.success("Пост опубликован");
    } catch { toast.error(restriction ? "Ваш аккаунт временно ограничен модератором" : "Не удалось опубликовать"); }
  }

  return (
    <>
      <PageHeader title="Сообщество" subtitle="Место, где можно поделиться опытом, задать вопрос и найти поддержку." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-4">
          {!userId ? (
            <section className="rounded-3xl border border-dashed border-rose/50 bg-blush/50 p-6 text-sm">
              <p className="font-semibold text-primary">Войдите, чтобы видеть публикации участниц и писать свои.</p>
              <p className="mt-1 text-muted-foreground">Сейчас показаны только демо-посты.</p>
              <Button className="mt-3" asChild><Link to="/auth">Войти</Link></Button>
            </section>
          ) : restriction ? (
            <p className="rounded-3xl bg-destructive/10 p-5 text-sm text-destructive">Модератор временно ограничил публикации с вашего аккаунта{restriction.until ? ` до ${new Date(restriction.until).toLocaleDateString("ru-RU")}` : ""}.</p>
          ) : (
            <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Чем хотите поделиться?" className="rounded-2xl" aria-label="Текст поста" />
              {needsRules && (
                <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
                  <span>Я прочитала правила сообщества и понимаю, что обсуждения не заменяют консультацию врача.</span></label>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Select value={cat} onValueChange={(v) => setCat(v as Category)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Под псевдонимом «{profile?.pseudonym}»</span>
                <Button className="ml-auto" onClick={publish}><Send /> Опубликовать</Button>
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            {(["all", ...(userId ? (["mine"] as const) : []), ...CATEGORIES] as const).map((c) => (
              <button key={c} onClick={() => setFilter(c)} className={`rounded-full border px-3 py-1 text-sm transition-colors ${filter === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-blush"}`}>{c === "all" ? "Все" : c === "mine" ? "Мои посты" : c}</button>
            ))}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          {!isLoading && visible.length === 0 && <p className="rounded-3xl bg-blush p-8 text-center text-muted-foreground">Здесь пока нет постов.</p>}
          {visible.map((p) => <PostCard key={p.id} p={p} onReport={setReport} />)}
        </div>

        <aside className="grid content-start gap-4">
          <div id="rules" className="rounded-3xl bg-blush p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-primary"><ShieldAlert className="h-4 w-4" /> Правила сообщества</p>
            <ul className="mt-2 grid list-disc gap-1 pl-4 text-secondary-foreground">{COMMUNITY_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="mt-3 text-secondary-foreground">Обсуждения в сообществе не заменяют консультацию врача. При любых новых изменениях в груди обратитесь к специалисту.</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
            <p>Пожаловаться на пост или комментарий можно через флажок. Заблокировать участницу — в меню «…». Список заблокированных — в профиле.</p>
            <p className="mt-2">Посты с отметкой <DemoBadge>демо</DemoBadge> — вымышленные примеры.</p>
          </div>
        </aside>
      </div>
      <ReportDialog target={report} onOpenChange={(o) => !o && setReport(null)} />
    </>
  );
}

function PostCard({ p, onReport }: { p: Post; onReport: (t: Target) => void }) {
  const { userId } = useAuth();
  const { data: likes } = useMyLikes();
  const act = useCommunityActions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.body);
  const [c, setC] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const mine = !!userId && p.author_id === userId;
  const liked = likes?.has(p.id) ?? false;
  const top = p.comments.filter((x) => !x.parent_id);
  const replies = (id: string) => p.comments.filter((x) => x.parent_id === id);
  const safe = async (fn: () => Promise<void>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); } catch { toast.error("Действие недоступно"); } };

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-blush font-display text-lg text-primary">{p.author_name[0]}</span>
        <div className="min-w-0 flex-1"><p className="font-semibold">{p.author_name}{mine && <span className="ml-1 text-xs font-normal text-muted-foreground">(вы)</span>}</p>
          <p className="text-xs text-muted-foreground">{p.category} · {timeAgo(p.created_at)}{p.edited_at && " · изменено"}</p></div>
        {p.is_demo && <DemoBadge />}
        {userId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Действия с постом"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mine ? (<>
                <DropdownMenuItem onClick={() => { setDraft(p.body); setEditing(true); }}><Pencil /> Изменить</DropdownMenuItem>
                <DropdownMenuItem onClick={() => confirm("Удалить пост?") && safe(() => act.deletePost(p.id), "Пост удалён")}><Trash2 /> Удалить</DropdownMenuItem>
              </>) : (<>
                <DropdownMenuItem onClick={() => onReport({ post_id: p.id })}><Flag /> Пожаловаться</DropdownMenuItem>
                {p.author_id && <DropdownMenuItem onClick={() => confirm(`Заблокировать «${p.author_name}»? Вы перестанете видеть её посты и комментарии.`) && safe(() => act.block(p.author_id!, p.author_name), "Участница заблокирована")}><Ban /> Заблокировать</DropdownMenuItem>}
              </>)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {p.removed_at && <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">Пост скрыт модератором и виден только вам.</p>}
      {editing ? (
        <div className="mt-3 grid gap-2">
          <Textarea value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex gap-2"><Button size="sm" onClick={() => safe(async () => { await act.editPost(p.id, p.category as Category, draft.trim()); setEditing(false); }, "Сохранено")}>Сохранить</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Отмена</Button></div>
        </div>
      ) : <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{p.body}</p>}
      <div className="mt-4 flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={!userId} onClick={() => safe(() => act.toggleLike(p.id, liked))} aria-pressed={liked} aria-label={liked ? "Убрать лайк" : "Нравится"}>
          <Heart className={liked ? "fill-rose text-rose" : ""} /> {p.likes_count}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}><MessageCircle /> {p.comments.length}</Button>
        {userId && !mine && <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => onReport({ post_id: p.id })}><Flag /> Пожаловаться</Button>}
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3">
          {top.map((cm) => (
            <div key={cm.id} className="grid gap-2">
              <CommentRow cm={cm} onReply={() => setReplyTo(cm)} onReport={onReport} />
              {replies(cm.id).map((r) => <div key={r.id} className="ml-6"><CommentRow cm={r} onReply={() => setReplyTo(cm)} onReport={onReport} /></div>)}
            </div>
          ))}
          {userId ? (
            <form className="grid gap-1" onSubmit={(e) => {
              e.preventDefault(); const t = c.trim(); if (!t) return;
              safe(async () => { await act.comment(p.id, t.slice(0, 1000), replyTo?.id); setC(""); setReplyTo(null); });
            }}>
              {replyTo && <p className="text-xs text-muted-foreground">Ответ для {replyTo.author_name} · <button type="button" className="underline" onClick={() => setReplyTo(null)}>отменить</button></p>}
              <div className="flex gap-2">
                <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="Написать тёплый комментарий…" maxLength={1000} className="rounded-full" aria-label="Комментарий" />
                <Button type="submit" size="icon" aria-label="Отправить"><Send /></Button>
              </div>
            </form>
          ) : <p className="text-xs text-muted-foreground"><Link to="/auth" className="underline">Войдите</Link>, чтобы комментировать.</p>}
        </div>
      )}
    </article>
  );
}

function CommentRow({ cm, onReply, onReport }: { cm: Comment; onReply: () => void; onReport: (t: Target) => void }) {
  const { userId } = useAuth();
  const act = useCommunityActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cm.body);
  const mine = !!userId && cm.author_id === userId;
  return (
    <div className="rounded-2xl bg-muted px-3 py-2 text-sm">
      <div className="flex items-center gap-1">
        <span className="font-semibold">{cm.author_name}</span>
        <span className="text-xs text-muted-foreground">· {timeAgo(cm.created_at)}{cm.edited_at && " · изменено"}</span>
        {userId && (
          <span className="ml-auto flex gap-0.5">
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ответить" onClick={onReply}><Reply /></Button>
            {mine ? (<>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Изменить комментарий" onClick={() => setEditing(true)}><Pencil /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Удалить комментарий" onClick={() => confirm("Удалить комментарий?") && act.deleteComment(cm.id)}><Trash2 /></Button>
            </>) : <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Пожаловаться на комментарий" onClick={() => onReport({ comment_id: cm.id })}><Flag /></Button>}
          </span>
        )}
      </div>
      {editing ? (
        <form className="mt-1 flex gap-2" onSubmit={async (e) => { e.preventDefault(); await act.editComment(cm.id, draft.trim()); setEditing(false); }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} /><Button size="sm" type="submit">OK</Button>
        </form>
      ) : <p>{cm.body}</p>}
    </div>
  );
}
