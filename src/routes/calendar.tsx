import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CalendarHeart, Check, Info, Pencil, Plus, Trash2, Undo2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app-shell";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { NoticeList } from "@/components/notification-bell";
import { apptDate, formatDate, groupAppointments, STATUS_LABEL, useAppointmentActions, useAppointments, viewStatus, type Appointment, type ViewStatus } from "@/lib/appointments";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Мой календарь — PINK SHIELD" },
      { name: "description", content: "Планируйте обследования молочных желёз и храните полную историю визитов." },
      { property: "og:title", content: "Мой календарь — PINK SHIELD" },
      { property: "og:description", content: "УЗИ, маммография, консультации — всё под рукой." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const ONE: Record<ViewStatus, string> = { upcoming: "Предстоит", completed: "Пройдено", missed: "Пропущено", cancelled: "Отменено" };
const BADGE: Record<ViewStatus, string> = {
  upcoming: "bg-blush text-primary", completed: "bg-muted text-foreground", missed: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground",
};

function CalendarPage() {
  const { userId, ready } = useAuth();
  const { data: appts = [], isLoading } = useAppointments();
  const act = useAppointmentActions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const groups = groupAppointments(appts);
  const days = appts.filter((a) => a.status !== "cancelled").map((a) => apptDate(a));

  const run = async (p: Promise<void>, ok: string) => { try { await p; toast.success(ok); } catch { toast.error("Не удалось сохранить"); } };
  const openNew = () => { setEditing(null); setOpen(true); };

  const Item = ({ a }: { a: Appointment }) => {
    const vs = viewStatus(a);
    return (
      <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blush text-primary"><CalendarHeart className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-semibold ${vs === "cancelled" ? "text-muted-foreground line-through" : ""}`}>{a.type}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[vs]}`}>{ONE[vs]}</span>
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(a)}, {a.start_time.slice(0, 5)}{a.place && ` · ${a.place}`}</p>
          {a.notes && <p className="mt-1 text-sm">{a.notes}</p>}
          {(a.remind_day_before || a.remind_same_day) && vs === "upcoming" && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Bell className="h-3 w-3" /> {[a.remind_day_before && "за день", a.remind_same_day && "в день визита"].filter(Boolean).join(", ")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {a.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => run(act.setStatus(a.id, "completed"), "Отмечено как пройденное")}><Check /> Пройдено</Button>}
          {a.status === "scheduled" && <Button size="sm" variant="ghost" onClick={() => run(act.setStatus(a.id, "cancelled"), "Визит отменён")}><Ban /> Отменить</Button>}
          {a.status !== "scheduled" && <Button size="sm" variant="ghost" onClick={() => run(act.setStatus(a.id, "scheduled"), "Возвращено в запланированные")}><Undo2 /> Вернуть</Button>}
          <Button size="icon" variant="ghost" aria-label="Изменить" onClick={() => { setEditing(a); setOpen(true); }}><Pencil /></Button>
          <Button size="icon" variant="ghost" aria-label="Удалить" onClick={() => { if (confirm("Удалить запись навсегда? Обычно лучше отметить её как отменённую.")) run(act.remove(a.id), "Запись удалена"); }}><Trash2 /></Button>
        </div>
      </li>
    );
  };

  if (ready && !userId) return (<><PageHeader title="Мой календарь" subtitle="Записывайте обследования и храните историю визитов." /><SignInPrompt text="Визиты и напоминания хранятся в вашем аккаунте и доступны с любого устройства." /></>);

  return (
    <>
      <PageHeader title="Мой календарь" subtitle="Записывайте обследования, о которых вы договорились с врачом. Прошедшие визиты всегда остаются в истории."
        action={<Button size="lg" onClick={openNew}><Plus /> Добавить обследование</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Tabs defaultValue="upcoming">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {(Object.keys(STATUS_LABEL) as ViewStatus[]).map((k) => <TabsTrigger key={k} value={k}>{STATUS_LABEL[k]} ({groups[k].length})</TabsTrigger>)}
          </TabsList>
          {(Object.keys(STATUS_LABEL) as ViewStatus[]).map((k) => (
            <TabsContent key={k} value={k} className="mt-4">
              {isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : groups[k].length === 0 ? (
                k === "upcoming" ? (
                  <div className="rounded-3xl border border-dashed border-rose/50 bg-blush/50 p-10 text-center">
                    <CalendarHeart className="mx-auto h-10 w-10 text-rose" />
                    <p className="mt-3 font-display text-2xl text-primary">Пока пусто</p>
                    <p className="mt-1 text-sm text-muted-foreground">Добавьте обследование — так проще ничего не забыть.</p>
                    <Button className="mt-4" onClick={openNew}><Plus /> Добавить</Button>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Здесь пока ничего нет.</p>
              ) : <ul className="grid gap-3">{groups[k].map((a) => <Item key={a.id} a={a} />)}</ul>}
            </TabsContent>
          ))}
        </Tabs>
        <aside className="grid content-start gap-4">
          <div className="rounded-3xl border border-border bg-card p-3 shadow-soft"><Calendar mode="multiple" selected={days} className="mx-auto" /></div>
          <div className="rounded-3xl bg-blush p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold text-primary"><Bell className="h-4 w-4" /> Напоминания</p>
            <NoticeList compact />
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-primary"><Info className="h-4 w-4" /> Важно</p>
            <p className="mt-2 text-muted-foreground">Приложение не подбирает график обследований. Как часто и какие обследования вам нужны, решает врач.</p>
          </div>
        </aside>
      </div>
      <AppointmentDialog open={open} onOpenChange={setOpen} initial={editing} onSave={async (d) => {
        await act.save(d, editing?.id);
        toast.success(editing ? "Изменения сохранены" : "Обследование добавлено");
      }} />
    </>
  );
}
