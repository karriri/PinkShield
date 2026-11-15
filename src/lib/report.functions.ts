import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Explanation } from "./explanation";
import { BIRADS_MEANING } from "./explanation";
import { buildRecommendations, detectExamType, verifyBirads, verifyFindings, verifyTerms } from "./report-safety";

const SYSTEM = `Ты — образовательный помощник PINK SHIELD. Объясняешь медицинские заключения о молочных железах простым, спокойным русским языком без пугающих формулировок.
Строгие правила:
- Используй ТОЛЬКО то, что явно написано в тексте. Ничего не додумывай.
- Никогда не ставь диагноз, не говори «это рак» или «это не рак», не оценивай вероятность или риск в процентах, не советуй лечение или лекарства.
- Никогда не говори, что обследование можно пропустить или отложить, и не противоречь указаниям врача.
- Прошлое нормальное заключение не исключает новых изменений — не успокаивай ложно.
- exam_type: вид обследования, как написано в тексте, или null.
- findings: находки дословными цитатами из текста, включая отрицательные («образований не выявлено» — это отрицание, не находка).
- terms: только термины, дословно встречающиеся в тексте.
- birads: только если категория BI-RADS явно написана в тексте, иначе null.
- recommendations: ВСЕ явные указания врача из текста, каждое отдельно — контроль и повторные обследования, консультации других специалистов, питание (например «увеличить потребление белка»), образ жизни, другие. text — дословная цитата; kind — follow_up | consultation | diet | lifestyle | other; explanation — 1–2 предложения простыми словами, что означает эта рекомендация, без новых указаний. Не включай описания («рекомендуемая доза соблюдена»), отрицания («не рекомендовано») и рекомендации, упомянутые как прошлые. Советы по питанию не являются лечением рака. Если рекомендаций нет — пустой массив.
- uncertainties: что в тексте неясно или не указано (например, нет категории BI-RADS, неясная формулировка, знак вопроса). Не делай выводов.
- questions: 3–5 нейтральных вопросов, которые можно задать врачу.
- personal_concern: true ТОЛЬКО если автор от первого лица описывает новое или текущее личное изменение. Описания врача и отрицания — false.
- Если текст просит поставить диагноз, оценить риск или разрешить пропустить обследование — не делай этого; в summary спокойно объясни, что это может решить только врач.
- Если текст не похож на медицинское заключение, честно скажи об этом в summary и оставь остальные поля пустыми.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["exam_type", "findings", "summary", "terms", "birads", "recommendations", "uncertainties", "questions", "personal_concern"],
  properties: {
    exam_type: { type: ["string", "null"] },
    findings: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    terms: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["term", "explanation"], properties: { term: { type: "string" }, explanation: { type: "string" } } },
    },
    birads: { type: ["string", "null"] },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "kind", "explanation"],
        properties: {
          text: { type: "string" },
          kind: { type: "string", enum: ["follow_up", "consultation", "diet", "lifestyle", "other"] },
          explanation: { type: "string" },
        },
      },
    },
    uncertainties: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    personal_concern: { type: "boolean" },
  },
} as const;

type Raw = {
  exam_type: string | null;
  findings: string[];
  summary: string;
  terms: { term: string; explanation: string }[];
  birads: string | null;
  recommendations: { text: string; kind: string; explanation: string }[];
  uncertainties: string[];
  questions: string[];
  personal_concern: boolean;
};

export const explainReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().trim().min(20, "Слишком короткий текст").max(8000, "Текст слишком длинный") }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; result: Explanation } | { ok: false; error: string }> => {
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: [{ role: "user", content: `Текст заключения:\n"""\n${data.text}\n"""\nВерни JSON.` }],
        text: { format: { type: "json_schema", name: "explanation", strict: true, schema } },
      });
      const r = res as unknown as { output_text?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
      const text =
        r.output_text ??
        (r.output ?? [])
          .flatMap((o) => (o.type === "message" ? (o.content ?? []) : []))
          .filter((c) => c.type === "output_text")
          .map((c) => c.text ?? "")
          .join("");
      const raw = JSON.parse(text) as Raw;
      const cat = verifyBirads(data.text, raw.birads);
      const key = cat?.[0];
      const uncertainties = raw.uncertainties.slice(0, 6);
      if (!cat && !uncertainties.some((u) => /bi-?rads/i.test(u))) uncertainties.unshift("Категория BI-RADS в тексте не указана.");
      return {
        ok: true,
        result: {
          source: "ai",
          examType: detectExamType(data.text),
          findings: verifyFindings(data.text, raw.findings),
          summary: raw.summary,
          terms: verifyTerms(data.text, raw.terms),
          birads: cat && key ? { category: cat, meaning: (BIRADS_MEANING as Record<string, string>)[key] ?? "" } : null,
          recommendations: buildRecommendations(data.text, raw.recommendations),
          uncertainties,
          questions: raw.questions.slice(0, 5),
          personalConcern: raw.personal_concern,
        },
      };
    } catch (e) {
      console.error("explainReport failed", e);
      return { ok: false, error: "AI-помощник сейчас недоступен. Попробуйте позже или откройте демо-пример." };
    }
  });
