import { describe, expect, it } from "vitest";
import { buildRecommendations, classifyStatement, extractRecommendationLines, verifyBirads, verifyQuotes, verifyTerms } from "@/lib/report-safety";
import { groupAppointments, viewStatus, type Appointment } from "@/lib/appointments";
import { splitNotices } from "@/lib/notifications";
import { EMPTY_ANSWERS, navigate, type GuidanceStatement } from "@/lib/navigator";
import { checkRewrite } from "@/lib/guidance-check";

const report = "Заключение: простая киста. BI-RADS 2. Рекомендовано: консультация маммолога.";

describe("report safety", () => {
  it("keeps a BI-RADS category written in the text", () => expect(verifyBirads(report, "2")).toBe("2"));
  it("drops a BI-RADS category not in the text", () => expect(verifyBirads(report, "4")).toBeNull());
  it("drops BI-RADS when the text has none", () => expect(verifyBirads("Образований нет.", "1")).toBeNull());
  it("keeps only recommendations quoted from the text", () =>
    expect(verifyQuotes(report, ["консультация маммолога", "биопсия через месяц"])).toEqual(["консультация маммолога"]));
  it("keeps only terms that appear in the text", () =>
    expect(verifyTerms(report, [{ term: "киста" }, { term: "фиброаденома" }]).map((t) => t.term)).toEqual(["киста"]));
});

describe("recommendation extraction", () => {
  it("captures a diet recommendation (protein) even if AI misses it", () => {
    const r = buildRecommendations("УЗИ молочных желёз. Рекомендовано: контроль через 6 месяцев; увеличить потребление белка.", []);
    expect(r.map((x) => x.text)).toEqual(["контроль через 6 месяцев", "увеличить потребление белка"]);
    expect(r[1]!.kind).toBe("diet");
  });
  it("keeps the full sentence as context", () =>
    expect(buildRecommendations("Рекомендовано: консультация маммолога.", [])[0]!.passage).toBe("Рекомендовано: консультация маммолога."));
  it("ignores descriptive 'рекомендуемая доза'", () => expect(extractRecommendationLines("Рекомендуемая доза облучения соблюдена.")).toEqual([]));
  it("ignores 'следует отметить'", () => expect(extractRecommendationLines("Следует отметить, что структура однородная.")).toEqual([]));
  it("ignores negated 'не рекомендовано'", () => expect(extractRecommendationLines("Биопсия не рекомендована.")).toEqual([]));
  it("does not treat 'образований не выявлено' as a recommendation", () => expect(extractRecommendationLines("Образований не выявлено.")).toEqual([]));
  it("drops an AI quote that is a negation", () => expect(buildRecommendations("Биопсия не рекомендована.", [{ text: "Биопсия не рекомендована" }])).toEqual([]));
  it("labels conditional recommendations", () => expect(classifyStatement("При появлении уплотнения рекомендуется консультация маммолога.")).toBe("conditional"));
  it("labels ambiguous recommendations", () => expect(classifyStatement("Возможно, рекомендуется МРТ по показаниям.")).toBe("uncertain"));
  it("reports no recommendations when there are none", () => expect(buildRecommendations("Узловых образований не выявлено. BI-RADS 1.", [])).toEqual([]));
});

const G: GuidanceStatement[] = [
  { key: "kz-screening", text: "", version: 1, age_min: 40, age_max: 76, interval_years: 2, even_ages_only: true, source: null },
];
const types = (a: Partial<typeof EMPTY_ANSWERS>) => navigate({ ...EMPTY_ANSWERS, ...a }, G).map((r) => r.type);

describe("navigator", () => {
  it("routine screening for a 44-year-old without concerns", () => expect(types({ age: 44, newChange: "no", underFollowUp: "no", familyHistory: "no", highRisk: "no" })).toEqual(["screening"]));
  it("new change → evaluation first, any age", () => expect(types({ age: 25, newChange: "yes", underFollowUp: "no" })[0]).toBe("symptom"));
  it("under follow-up → never routine screening", () => expect(types({ age: 50, underFollowUp: "yes" })).toEqual(["follow_up"]));
  it("family history → individual assessment", () => expect(types({ age: 45, familyHistory: "yes", underFollowUp: "no", newChange: "no" })).toContain("individual"));
  it("no answers → insufficient", () => expect(types({})).toEqual(["insufficient"]));
  it("age 77 is outside the KZ group", () => expect(navigate({ ...EMPTY_ANSWERS, age: 77 }, G)[0]!.nextStep).toMatch(/старше/));
  it("age 39 is below the KZ group", () => expect(navigate({ ...EMPTY_ANSWERS, age: 39 }, G)[0]!.nextStep).toMatch(/с 40 лет/));
  it("never says healthy, percent or diagnosis", () => {
    const all = JSON.stringify(navigate({ ...EMPTY_ANSWERS, age: 50, newChange: "yes", familyHistory: "yes" }, G));
    expect(all).not.toMatch(/здоров|%|диагноз:/i);
  });
});

describe("guidance rewrite check", () => {
  const approved = "Женщины в возрасте от 40 до 76 лет — один раз в 2 года.";
  it("rejects a new age", () => expect(checkRewrite(approved, "Женщинам с 45 лет раз в 2 года.").ok).toBe(false));
  it("rejects false reassurance", () => expect(checkRewrite(approved, "Если вам 40–76 лет, вы здоровы и можно не беспокоиться.").ok).toBe(false));
  it("accepts a faithful rewrite", () => expect(checkRewrite(approved, "Если вам от 40 до 76 лет, обследование проводят раз в 2 года.").ok).toBe(true));
});

describe("appointments", () => {
  const base = { type: "Маммография", place: "", notes: "", start_time: "10:00", remind_day_before: true, remind_same_day: false } as const;
  const list: Appointment[] = [
    { ...base, id: "future", starts_on: "2030-01-01", status: "scheduled" },
    { ...base, id: "past", starts_on: "2020-01-01", status: "scheduled" },
    { ...base, id: "done", starts_on: "2020-02-01", status: "completed" },
    { ...base, id: "off", starts_on: "2030-02-01", status: "cancelled" },
  ];
  const now = new Date("2026-01-01");
  it("derives four statuses and keeps every record", () => {
    expect(list.map((a) => viewStatus(a, now))).toEqual(["upcoming", "missed", "completed", "cancelled"]);
    const g = groupAppointments(list, now);
    expect(Object.values(g).flat().length).toBe(4);
  });
});

describe("notifications", () => {
  const n = (id: string, due: string, extra = {}) => ({ id, title: "", kind: "day_before", due_at: due, read_at: null, dismissed_at: null, ...extra });
  it("hides dismissed, counts unread due ones", () => {
    const r = splitNotices([n("a", "2025-01-01"), n("b", "2025-01-02", { read_at: "x" }), n("c", "2025-01-03", { dismissed_at: "x" }), n("d", "2030-01-01")], new Date("2026-01-01"));
    expect(r.due.map((x) => x.id)).toEqual(["b", "a"]);
    expect(r.unread).toBe(1);
    expect(r.scheduled.map((x) => x.id)).toEqual(["d"]);
  });
});

describe("exam type and conditional AI quotes", () => {
  it("detects УЗИ and ignores a negated biopsy", async () => {
    const { detectExamType } = await import("@/lib/report-safety");
    expect(detectExamType("УЗИ молочных желёз. Биопсия не рекомендована.")).toBe("УЗИ");
  });
  it("marks an AI-found 'при появлении' quote as conditional", () =>
    expect(buildRecommendations("При появлении уплотнения — консультация маммолога.", [{ text: "При появлении уплотнения — консультация маммолога" }])[0]!.certainty).toBe("conditional"));
  it("rejects a rewrite with a new instruction", () => expect(checkRewrite("Скрининг проводят раз в 2 года.", "Сдайте анализы, скрининг раз в 2 года.").ok).toBe(false));
});
