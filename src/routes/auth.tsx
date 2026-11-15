import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — PINK SHIELD" },
      { name: "description", content: "Войдите в PINK SHIELD, чтобы сохранять визиты, напоминания и участвовать в сообществе." },
      { property: "og:title", content: "Вход — PINK SHIELD" },
      { property: "og:description", content: "Аккаунт под псевдонимом — без лишних личных данных." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const G = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>`;

function GoogleButton() {
  return (
    <button type="button" className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[#747775] bg-[#FFFFFF] px-3 py-2.5 text-sm font-medium text-[#1F1F1F]"
      onClick={async () => {
        const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
        if (r.error) toast.error("Не удалось войти через Google");
      }}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: G }} className="flex" />
      Продолжить с Google
    </button>
  );
}

function AuthPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudonym, setPseudonym] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (userId) navigate({ to: "/", replace: true }); }, [userId, navigate]);

  async function signIn(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message.includes("confirm") ? "Подтвердите почту по ссылке из письма" : "Неверная почта или пароль");
  }
  async function signUp(e: FormEvent) {
    e.preventDefault();
    if (pseudonym.trim().length < 2) return toast.error("Псевдоним — минимум 2 символа");
    if (password.length < 8) return toast.error("Пароль — минимум 8 символов");
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password, options: {
      emailRedirectTo: window.location.origin,
      data: { pseudonym: pseudonym.trim().slice(0, 40), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    } });
    setBusy(false);
    if (error) toast.error(error.message); else setSent(true);
  }
  async function reset() {
    if (!email) return toast.error("Введите почту");
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    toast.success("Если аккаунт существует, мы отправили письмо со ссылкой");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-4xl font-semibold text-primary">Добро пожаловать</h1>
      <p className="mt-2 text-sm text-muted-foreground">В сообществе видно только ваш псевдоним. Мы не просим имя, возраст или телефон.</p>
      <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
        {sent ? (
          <p className="text-sm">Мы отправили письмо на <b>{email}</b>. Перейдите по ссылке в нём, чтобы подтвердить почту, затем войдите.</p>
        ) : (
          <Tabs defaultValue="in">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="in">Вход</TabsTrigger><TabsTrigger value="up">Регистрация</TabsTrigger></TabsList>
            <TabsContent value="in">
              <form onSubmit={signIn} className="mt-4 grid gap-3">
                <div className="grid gap-2"><Label htmlFor="e1">Почта</Label><Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="p1">Пароль</Label><Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={busy}>Войти</Button>
                <Button type="button" variant="link" className="px-0 text-xs" onClick={reset}>Забыли пароль?</Button>
              </form>
            </TabsContent>
            <TabsContent value="up">
              <form onSubmit={signUp} className="mt-4 grid gap-3">
                <div className="grid gap-2"><Label htmlFor="n2">Псевдоним</Label><Input id="n2" maxLength={40} required placeholder="Например, Тихая_Волна" value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Не используйте настоящее имя и фамилию.</p></div>
                <div className="grid gap-2"><Label htmlFor="e2">Почта</Label><Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="p2">Пароль (от 8 символов)</Label><Input id="p2" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={busy}>Создать аккаунт</Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />или<span className="h-px flex-1 bg-border" /></div>
        <GoogleButton />
      </div>
    </div>
  );
}
