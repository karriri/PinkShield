import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GuidanceStatement } from "./navigator";

export function useGuidance(includeInactive = false) {
  return useQuery({
    queryKey: ["guidance", includeInactive],
    queryFn: async (): Promise<(GuidanceStatement & { id: string; active: boolean; source_id: string })[]> => {
      let q = supabase.from("guidance_statements").select("*, guidance_sources(organization,title,url,country,checked_on)").order("key").order("version", { ascending: false });
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, source: r.guidance_sources }));
    },
  });
}
