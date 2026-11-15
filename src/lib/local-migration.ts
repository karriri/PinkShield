import { supabase } from "@/integrations/supabase/client";
import { EXAM_TYPES } from "./appointments";
import { CATEGORIES } from "./community";

const DONE = "ps.migrated";
type LocalAppt = { type: string; date: string; time: string; place: string; notes: string; completed: boolean; demo?: boolean };
type LocalPost = { category: string; text: string; demo?: boolean };

function read<T>(k: string): T | undefined {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : undefined; } catch { return undefined; }
}

/** What this browser still holds from before accounts existed (demo items excluded). */
export function localLeftovers() {
  if (typeof window === "undefined" || localStorage.getItem(DONE)) return null;
  const appts = (read<LocalAppt[]>("ps.appointments") ?? []).filter((a) => !a.demo && a.date);
  const posts = (read<LocalPost[]>("ps.posts") ?? []).filter((p) => !p.demo && p.text);
  const saved = read<{ saved?: string[] }>("ps.profile")?.saved ?? [];
  if (!appts.length && !posts.length && !saved.length) return null;
  return { appts, posts, saved };
}

export function forgetLocal() {
  for (const k of ["ps.appointments", "ps.posts", "ps.profile"]) localStorage.removeItem(k);
  localStorage.setItem(DONE, "1");
}

export async function migrateLocal() {
  const d = localLeftovers();
  if (!d) return 0;
  const rows = d.appts.map((a) => ({
    type: (EXAM_TYPES as readonly string[]).includes(a.type) ? a.type : "Другое",
    starts_on: a.date, start_time: a.time || "10:00", place: (a.place ?? "").slice(0, 120), notes: (a.notes ?? "").slice(0, 500),
    status: a.completed ? "completed" : "scheduled",
  }));
  if (rows.length) { const { error } = await supabase.from("appointments").insert(rows); if (error) throw error; }
  for (const p of d.posts) {
    const category = (CATEGORIES as readonly string[]).includes(p.category) ? p.category : "Мой опыт";
    const { error } = await supabase.from("posts").insert({ category, body: p.text.slice(0, 2000), author_name: "" });
    if (error) throw error;
  }
  if (d.saved.length) await supabase.from("saved_articles").upsert(d.saved.map((article_id) => ({ article_id })), { onConflict: "user_id,article_id", ignoreDuplicates: true });
  forgetLocal();
  return rows.length + d.posts.length + d.saved.length;
}
