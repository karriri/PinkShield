import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { splitNotices, useNoticeActions, useNotifications } from "@/lib/notifications";
import { useAuth } from "@/lib/auth";

export function NoticeList({ compact = false }: { compact?: boolean }) {
  const { data = [] } = useNotifications();
  const act = useNoticeActions();
  const { due, scheduled } = splitNotices(data);
  const fmt = (s: string) => new Date(s).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="grid gap-3 text-sm">
      {due.length === 0 ? <p className="text-muted-foreground">Новых напоминаний нет.</p> : (
        <ul className="grid gap-2">
          {due.slice(0, compact ? 3 : 20).map((n) => (
            <li key={n.id} className={`flex items-start gap-2 rounded-2xl px-3 py-2 ${n.read_at ? "bg-muted" : "bg-blush"}`}>
              <div className="min-w-0 flex-1">
                <p className={n.read_at ? "text-muted-foreground" : "font-semibold"}>{n.title}</p>
                <p className="text-xs text-muted-foreground">{fmt(n.due_at)}</p>
              </div>
              {!n.read_at && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Отметить прочитанным" onClick={() => act.read([n.id])}><Check /></Button>}
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Скрыть" onClick={() => act.dismiss(n.id)}><X /></Button>
            </li>
          ))}
        </ul>
      )}
      {!compact && scheduled.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Запланированы</p>
          <ul className="grid gap-1">{scheduled.slice(0, 6).map((n) => <li key={n.id} className="flex justify-between gap-2 text-xs"><span>{n.title}</span><span className="shrink-0 text-muted-foreground">{fmt(n.due_at)}</span></li>)}</ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Напоминания показываются внутри приложения. Уведомления на телефон пока не отправляются.</p>
    </div>
  );
}

export function NotificationBell() {
  const { userId } = useAuth();
  const { data = [] } = useNotifications();
  const act = useNoticeActions();
  if (!userId) return null;
  const { due, unread } = splitNotices(data);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Напоминания${unread ? `: ${unread} новых` : ""}`}>
          <Bell />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-xl text-primary">Напоминания</p>
          {unread > 0 && <Button size="sm" variant="link" className="px-0" onClick={() => act.read(due.filter((n) => !n.read_at).map((n) => n.id))}>Прочитать все</Button>}
        </div>
        <NoticeList />
      </PopoverContent>
    </Popover>
  );
}
