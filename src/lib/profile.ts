import { usePersistent } from "./store";
export type Profile = { name: string; language: "ru" | "en"; saved: string[]; activity: { text: string; at: number }[] };
export function useProfile() {
  return usePersistent<Profile>("ps.profile", () => ({ name: "Айгерим", language: "ru", saved: [], activity: [] }));
}
export function logActivity(set: (fn: (p: Profile) => Profile) => void, text: string) {
  set((p) => ({ ...p, activity: [{ text, at: Date.now() }, ...p.activity].slice(0, 8) }));
}
