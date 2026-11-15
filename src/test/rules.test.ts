import { describe, expect, it } from "vitest";
import { verifyBirads, verifyQuotes, verifyTerms } from "@/lib/report-safety";
import { splitAppointments, type Appointment } from "@/lib/appointments";

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

describe("appointments", () => {
  const base = { type: "Маммография", place: "", notes: "", time: "10:00" } as const;
  const list: Appointment[] = [
    { ...base, id: "future", date: "2030-01-01", completed: false },
    { ...base, id: "past", date: "2020-01-01", completed: false },
    { ...base, id: "done", date: "2030-02-01", completed: true },
  ];
  it("splits upcoming vs history", () => {
    const { upcoming, history } = splitAppointments(list, new Date("2026-01-01"));
    expect(upcoming.map((a) => a.id)).toEqual(["future"]);
    expect(history.map((a) => a.id).sort()).toEqual(["done", "past"]);
  });
});
