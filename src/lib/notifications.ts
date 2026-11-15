import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type Notice = { id: string; title: string; due_at: string; read_at: string | null; dismissed_at: string | null; kind: string };

/** Due = time has come and not dismissed; scheduled = still in the future. */
export function splitNotices<T extends Notice>(list: T[], now: Date = new Date()) {
  const live = list.filter((n) => !n.dismissed_at);
  const due = live.filter((n) => new Date(n.due_at) <= now).sort((a, b) => +new Date(b.due_at) - +new Date(a.due_at));
  const scheduled = live.filter((n) => new Date(n.due_at) > now).sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at));
  return { due, scheduled, unread: due.filter((n) => !n.read_at).length };
}

export function useNotifications() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("id,title,due_at,read_at,dismissed_at,kind")
        .is("dismissed_at", null).order("due_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useNoticeActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  return {
    async read(ids: string[]) {
      if (ids.length) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
      done();
    },
    async dismiss(id: string) {
      await supabase.from("notifications").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
      done();
    },
  };
}
