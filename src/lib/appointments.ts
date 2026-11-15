import { usePersistent, uid } from "./store";

export const EXAM_TYPES = [
  "УЗИ молочных желёз",
  "Маммография",
  "Консультация врача",
  "Другое",
] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export type Appointment = {
  id: string;
  type: ExamType;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  place: string;
  notes: string;
  completed: boolean;
  demo?: boolean;
};

export function apptDate(a: Appointment) {
  return new Date(`${a.date}T${a.time || "00:00"}:00`);
}

/** Upcoming: not completed and not in the past. History: completed or past. */
export function splitAppointments(list: Appointment[], now: Date = new Date()) {
  const upcoming = list
    .filter((a) => !a.completed && apptDate(a).getTime() >= now.getTime())
    .sort((a, b) => apptDate(a).getTime() - apptDate(b).getTime());
  const history = list
    .filter((a) => a.completed || apptDate(a).getTime() < now.getTime())
    .sort((a, b) => apptDate(b).getTime() - apptDate(a).getTime());
  return { upcoming, history };
}

function iso(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
}

export function seedAppointments(): Appointment[] {
  return [
    { id: uid(), type: "УЗИ молочных желёз", date: shift(9), time: "10:30", place: "Клиника «Здоровье» (демо)", notes: "Взять результаты прошлого УЗИ", completed: false, demo: true },
    { id: uid(), type: "Консультация врача", date: shift(23), time: "15:00", place: "Маммолог, д-р Иванова (демо)", notes: "", completed: false, demo: true },
    { id: uid(), type: "Маммография", date: shift(-120), time: "09:00", place: "Диагностический центр (демо)", notes: "", completed: true, demo: true },
  ];
}

export function useAppointments() {
  return usePersistent<Appointment[]>("ps.appointments", seedAppointments);
}

export function formatDate(a: Appointment) {
  return apptDate(a).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
