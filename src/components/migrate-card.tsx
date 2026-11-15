import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { forgetLocal, localLeftovers, migrateLocal } from "@/lib/local-migration";

export function MigrateCard() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [info, setInfo] = useState<ReturnType<typeof localLeftovers>>(null);
  useEffect(() => { if (userId) setInfo(localLeftovers()); }, [userId]);
  if (!userId || !info) return null;
  return (
    <section className="rounded-3xl border border-rose/50 bg-blush p-5 text-sm">
      <p className="font-semibold text-primary">В этом браузере остались ваши прежние данные</p>
      <p className="mt-1 text-secondary-foreground">Визиты: {info.appts.length}, ваши посты: {info.posts.length}, сохранённые статьи: {info.saved.length}. Демо-записи не переносятся.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={async () => {
          try { const n = await migrateLocal(); setInfo(null); qc.invalidateQueries(); toast.success(`Перенесено записей: ${n}`); }
          catch { toast.error("Не удалось перенести. Попробуйте позже."); }
        }}>Перенести в аккаунт</Button>
        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Удалить старые данные из этого браузера без переноса?")) { forgetLocal(); setInfo(null); } }}>Не переносить</Button>
      </div>
    </section>
  );
}
