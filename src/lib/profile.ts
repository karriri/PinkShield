import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export function useSavedArticles() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["saved", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_articles").select("article_id");
      if (error) throw error;
      return data.map((r) => r.article_id);
    },
  });
}

export function useToggleSaved() {
  const qc = useQueryClient();
  return async (id: string, saved: boolean) => {
    if (saved) await supabase.from("saved_articles").delete().eq("article_id", id);
    else await supabase.from("saved_articles").insert({ article_id: id });
    qc.invalidateQueries({ queryKey: ["saved"] });
  };
}
