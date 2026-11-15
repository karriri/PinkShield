import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CalendarHeart, Check, Info, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { PageHeader, DemoBadge } from "@/components/app-shell";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { apptDate, formatDate, splitAppointments, useAppointments, type Appointment } from "@/lib/appointments";
import { logActivity, useProfile } from "@/lib/profile";
import { uid } from "@/lib/store";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Мой календарь — PINK SHIELD" },
      { name: "description", content: "Планируйте обследования молочных желёз и храните историю визитов в одном месте." },
      { property: "og:title", content: "Мой календарь — PINK SHIELD" },
      { property: "og:description", content: "УЗИ, маммография, консультации — всё под рукой." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const [appts, setAppts] = useAppointments();
  const [, setProfile] = useProfile();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const { upcoming, history } = splitAppointments(appts);
  const days = appts.map((a) => apptDate(a));

  const openNew = () => { setEditing(null); setOpen(true); };
  const toggle = (a: Appointment) => {
    setAppts((l) => l.map((x) => (x.id === a.id ? { ...x, completed: !x.completed } : x)));
    if (!a.completed) { logActivity(setProfile, `Пройдено: ${a.type}`); toast.success("Отмечено как пройденное"); }
  };
  const remove = (a: Appointment) => {
    if (!confirm("Удалить эту запись?")) return;
    setAppts((l) => l.filter((x) => x.id !== a.id));
    toast("Запись удалена");
  };

  const Item = ({ a }: { a: Appointment }) => (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blush text-primary"><CalendarHeart className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className={`font-semibold ${a.completed ? "text-muted-foreground line-through" : ""}`}>{a.type}</p>{a.demo && <DemoBadge />}</div>
        <p className="text-sm text-muted-foreground">{formatDate(a)}, {a.time}{a.place && ` · ${a.place}`}</p>
        {a.notes && <p className="mt-1 text-sm">{a.notes}</p>}
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" aria-label={a.completed ? "Вернуть в запланированные" : "Отметить пройденным"} onClick={() => toggle(a)}>{a.completed ? <Undo2 /> : <Check />}</Button>
        <Button size="icon" variant="ghost" aria-label="Изменить" onClick={() => { setEditing(a); setOpen(true); }}><Pencil /></Button>
        <Button size="icon" variant="ghost" aria-label="Удалить" onClick={() => remove(a)}><Trash2 /></Button>
      </div>
    </li>
  );

  return (
    <>
      <PageHeader title="Мой календарь" subtitle="Записывайте обследования, о которых вы договорились с врачом, и храните историю визитов."
        action={<Button size="lg" onClick={openNew}><Plus /> Добавить обследование</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-8">
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-primary">Предстоящие</h2>
            {upcoming.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-rose/50 bg-blush/50 p-10 text-center">
                <CalendarHeart className="mx-auto h-10 w-10 text-rose" />
                <p className="mt-3 font-display text-2xl text-primary">Пока пусто</p>
                <p className="mt-1 text-sm text-muted-foreground">Добавьте первое обследование — так проще ничего не забыть.</p>
                <Button className="mt-4" onClick={openNew}><Plus /> Добавить</Button>
              </div>
            ) : <ul className="grid gap-3">{upcoming.map((a) => <Item key={a.id} a={a} />)}</ul>}
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-primary">История обследований</h2>
            {history.length === 0 ? <p className="text-sm text-muted-foreground">Пройденные визиты появятся здесь.</p>
              : <ul className="grid gap-3">{history.map((a) => <Item key={a.id} a={a} />)}</ul>}
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-3xl border border-border bg-card p-3 shadow-soft">
            <Calendar mode="multiple" selected={days} className="mx-auto" />
          </div>
          <div className="rounded-3xl bg-blush p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-primary"><Bell className="h-4 w-4" /> Напоминание</p>
            <p className="mt-2 text-secondary-foreground">Ближайшие визиты показываются на главной странице. Уведомления на телефон пока не отправляются — добавьте визит и в свой календарь.</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-primary"><Info className="h-4 w-4" /> Важно</p>
            <p className="mt-2 text-muted-foreground">Приложение не подбирает график обследований. Как часто и какие обследования вам нужны, решает врач.</p>
          </div>
        </aside>
      </div>
      <AppointmentDialog open={open} onOpenChange={setOpen} initial={editing} onSave={(d) => {
        if (editing) { setAppts((l) => l.map((x) => (x.id === editing.id ? { ...x, ...d } : x))); toast.success("Изменения сохранены"); }
        else { setAppts((l) => [...l, { ...d, id: uid(), completed: false }]); logActivity(setProfile, `Добавлено: ${d.type}`); toast.success("Обследование добавлено"); }
      }} />
    </>
  );
}
