import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarHeart, Home, LogIn, LogOut, MessagesSquare, Sparkles, User, Shield, Gavel } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { useAuth, useIsAdmin, useMyProfile, useSignOut, useTimezoneSync } from "@/lib/auth";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/calendar", label: "Мой календарь", icon: CalendarHeart },
  { to: "/assistant", label: "AI-помощник", icon: Sparkles },
  { to: "/community", label: "Сообщество", icon: MessagesSquare },
  { to: "/knowledge", label: "База знаний", icon: BookOpen },
  { to: "/profile", label: "Профиль", icon: User },
] as const;

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-plum text-primary-foreground">
        <Shield className="h-4 w-4" />
      </span>
      <span className="font-display text-xl font-semibold tracking-wide text-primary">PINK SHIELD</span>
    </Link>
  );
}

function Account() {
  const { userId, ready } = useAuth();
  const { data: profile } = useMyProfile();
  const signOut = useSignOut();
  if (!ready) return null;
  if (!userId) return <Button size="sm" variant="outline" asChild><Link to="/auth"><LogIn /> Войти</Link></Button>;
  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{profile?.pseudonym}</span>
      <Button size="icon" variant="ghost" aria-label="Выйти" onClick={signOut}><LogOut /></Button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useTimezoneSync();
  const { data: isAdmin } = useIsAdmin();
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-5 lg:flex">
        <Logo />
        <p className="mt-2 text-xs text-muted-foreground">Забота о себе начинается с внимания</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/moderation" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}><Gavel className="h-4 w-4" />Модерация</Link>
          )}
        </nav>
        <div className="mt-6"><Account /></div>
        <div className="mt-auto rounded-2xl bg-blush p-4 text-xs leading-relaxed text-secondary-foreground">
          PINK SHIELD — образовательный проект. Он не ставит диагноз и не заменяет консультацию врача.
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          {isAdmin && <Button size="icon" variant="ghost" asChild aria-label="Модерация"><Link to="/moderation"><Gavel /></Link></Button>}
          <Account />
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-1 px-1 py-2 text-[10px] text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}>
            <Icon className="h-5 w-5" /><span className="truncate">{label === "Мой календарь" ? "Календарь" : label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-4xl font-semibold text-primary sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function DemoBadge({ children = "Демо-пример" }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-rose/40 bg-blush px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">{children}</span>;
}
