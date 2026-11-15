/** Checks that a plain-language rewrite adds nothing to an approved guidance statement. */
const numbers = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const FORBIDDEN = /(диагноз|вы здоров|здоровы|рака нет|не рак|это рак|процент|%|вероятност|не нужно обращаться|можно не|не обязательно|пропустить|лечени|препарат|лекарств|таблетк|срочно|немедленно|скорую)/i;
const INSTRUCTION = /(примите|принимайте|сдайте|пройдите|сделайте|запишитесь|обратитесь|избегайте|откажитесь|начните|прекратите)/i;

export function checkRewrite(approved: string, rewrite: string): { ok: boolean; reason?: string } {
  const t = rewrite.trim();
  if (t.length < 10 || t.length > approved.length * 2 + 200) return { ok: false, reason: "length" };
  const allowed = new Set(numbers(approved));
  if (numbers(t).some((n) => !allowed.has(n))) return { ok: false, reason: "new number" };
  if (FORBIDDEN.test(t) && !FORBIDDEN.test(approved)) return { ok: false, reason: "forbidden wording" };
  const m = t.match(INSTRUCTION);
  if (m && !approved.toLowerCase().includes(m[1]!.toLowerCase())) return { ok: false, reason: "new instruction" };
  return { ok: true };
}
