import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "./auth";

export const EXAM_TYPES = ["УЗИ молочных желёз", "Маммография", "Консультация врача", "Другое"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export type Appointment = Pick<Tables<"appointments">, "id" | "type" | "starts_on" | "start_time" | "place" | "notes" | "status" | "remind_day_before" | "remind_same_day"> & { created_at?: string };
export type Draft = Omit<Appointment, "id" | "status" | "created_at">;
export type ViewStatus = "upcoming" | "completed" | "missed" | "cancelled";

export const STATUS_LABEL: Record<ViewStatus, string> = {
  upcoming: "Предстоящие", completed: "Пройденные", missed: "Пропущенные", cancelled: "Отменённые",
};

export function apptDate(a: Pick<Appointment, "starts_on" | "start_time">) {
  return new Date(`${a.starts_on}T${(a.start_time || "00:00").slice(0, 5)}:00`);
}

/** A scheduled visit counts as missed only after its whole day has passed. Records are never removed. */
export function viewStatus(a: Pick<Appointment, "starts_on" | "start_time" | "status">, now: Date = new Date()): ViewStatus {
  if (a.status === "completed") return "completed";
  if (a.status === "cancelled") return "cancelled";
  const endOfDay = new Date(`${a.starts_on}T23:59:59`);
  return endOfDay.getTime() < now.getTime() ? "missed" : "upcoming";
}

export function groupAppointments<T extends Appointment>(list: T[], now: Date = new Date()) {
  const g: Record<ViewStatus, T[]> = { upcoming: [], completed: [], missed: [], cancelled: [] };
  for (const a of list) g[viewStatus(a, now)].push(a);
  g.upcoming.sort((a, b) => apptDate(a).getTime() - apptDate(b).getTime());
  for (const k of ["completed", "missed", "cancelled"] as const) g[k].sort((a, b) => apptDate(b).getTime() - apptDate(a).getTime());
  return g;
}

export function formatDate(a: Pick<Appointment, "starts_on" | "start_time">) {
  return apptDate(a).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function useAppointments() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["appointments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*").order("starts_on");
      if (error) throw error;
      return data;
    },
  });
}

export function useAppointmentActions() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); };
  return {
    async save(d: Draft, id?: string) {
      const row = { ...d, place: d.place.trim().slice(0, 120), notes: d.notes.trim().slice(0, 500) };
      const { error } = id ? await supabase.from("appointments").update(row).eq("id", id) : await supabase.from("appointments").insert(row);
      done();
      if (error) throw error;
    },
    async setStatus(id: string, status: "scheduled" | "completed" | "cancelled") {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      done();
      if (error) throw error;
    },
    async remove(id: string) {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      done();
      if (error) throw error;
    },
  };
}
