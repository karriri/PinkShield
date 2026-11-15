import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Новый пароль — PINK SHIELD" },
      { name: "description", content: "Задайте новый пароль для аккаунта PINK SHIELD." },
      { property: "og:title", content: "Новый пароль — PINK SHIELD" },
      { property: "og:description", content: "Восстановление доступа к аккаунту." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Минимум 8 символов");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error("Ссылка устарела. Запросите новую.");
    else { toast.success("Пароль обновлён"); navigate({ to: "/" }); }
  }
  return (
    <form onSubmit={submit} className="mx-auto grid max-w-md gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <h1 className="text-3xl font-semibold text-primary">Новый пароль</h1>
      <Label htmlFor="pw">Пароль</Label>
      <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <Button type="submit">Сохранить</Button>
    </form>
  );
}
