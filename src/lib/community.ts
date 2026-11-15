import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "./auth";

export const CATEGORIES = ["Мой опыт", "Вопрос врачу", "Поддержка", "Диагностика", "Во время лечения", "После лечения"] as const;
export type Category = (typeof CATEGORIES)[number];

export const REPORT_REASONS = {
  bullying: "Травля или преследование",
  insults: "Оскорбления, грубые выражения",
  threats: "Угрозы",
  spam: "Спам или реклама",
  misinformation: "Ложная информация под видом медицинского факта",
  harmful: "Неуместный или опасный контент",
  other: "Другое нарушение правил",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const COMMUNITY_RULES = [
  "Никакой травли, преследования и дискриминации.",
  "Никаких угроз и личных нападок.",
  "Не публикуйте чужую медицинскую информацию и личные данные.",
  "Не выдавайте личный опыт за гарантированный медицинский совет.",
  "Не распространяйте опасную медицинскую дезинформацию.",
  "Общайтесь с уважением и бережностью.",
];

export type Comment = Tables<"comments">;
export type Post = Tables<"posts"> & { comments: Comment[] };

export function usePosts() {
  const { userId, ready } = useAuth();
  return useQuery({
    queryKey: ["posts", userId],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*, comments(*)").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data as Post[]).map((p) => ({ ...p, comments: [...p.comments].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)) }));
    },
  });
}

export function useMyLikes() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["likes", userId], enabled: !!userId,
    queryFn: async () => new Set(((await supabase.from("post_likes").select("post_id")).data ?? []).map((r) => r.post_id)),
  });
}

export function useBlocks() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["blocks", userId], enabled: !!userId,
    queryFn: async () => (await supabase.from("blocks").select("*").order("created_at", { ascending: false })).data ?? [],
  });
}

export function useCommunityActions() {
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["posts"] }); qc.invalidateQueries({ queryKey: ["likes"] }); };
  const check = (e: { message: string } | null) => { refresh(); if (e) throw new Error(e.message); };
  return {
    async createPost(category: Category, body: string) { check((await supabase.from("posts").insert({ category, body, author_name: "" })).error); },
    async editPost(id: string, category: Category, body: string) { check((await supabase.from("posts").update({ category, body }).eq("id", id)).error); },
    async deletePost(id: string) { check((await supabase.from("posts").delete().eq("id", id)).error); },
    async comment(post_id: string, body: string, parent_id?: string) { check((await supabase.from("comments").insert({ post_id, body, parent_id: parent_id ?? null, author_name: "" })).error); },
    async editComment(id: string, body: string) { check((await supabase.from("comments").update({ body }).eq("id", id)).error); },
    async deleteComment(id: string) { check((await supabase.from("comments").delete().eq("id", id)).error); },
    async toggleLike(post_id: string, liked: boolean) {
      check(liked ? (await supabase.from("post_likes").delete().eq("post_id", post_id)).error : (await supabase.from("post_likes").insert({ post_id })).error);
    },
    async report(target: { post_id?: string; comment_id?: string }, reason: ReportReason, note: string) {
      const { error } = await supabase.from("content_reports").insert({ ...target, reason, note: note.trim().slice(0, 500) });
      if (error) throw new Error(error.message);
    },
    async block(blocked_id: string, blocked_name: string) {
      const { error } = await supabase.from("blocks").insert({ blocked_id, blocked_name });
      qc.invalidateQueries({ queryKey: ["blocks"] }); refresh();
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    },
    async unblock(blocked_id: string) {
      await supabase.from("blocks").delete().eq("blocked_id", blocked_id);
      qc.invalidateQueries({ queryKey: ["blocks"] }); refresh();
    },
  };
}

export function timeAgo(at: number | string) {
  const t = typeof at === "string" ? new Date(at).getTime() : at;
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.round(hrs / 24)} дн назад`;
}
