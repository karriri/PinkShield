import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Explanation } from "./explanation";
import { BIRADS_MEANING } from "./explanation";
import { buildRecommendations, verifyBirads, verifyTerms } from "./report-safety";

const SYSTEM = `Ты — образовательный помощник PINK SHIELD. Объясняешь медицинские заключения о молочных железах простым, спокойным русским языком.
Строгие правила:
- Объясняй ТОЛЬКО то, что явно написано в тексте. Ничего не додумывай.
- Никогда не ставь диагноз, не оценивай вероятность рака, не советуй лечение или лекарства, не говори откладывать визит к врачу.
- terms: только термины, которые дословно встречаются в тексте (копируй их точно как в тексте).
- birads: только если категория BI-RADS явно написана в тексте, иначе null. Не выводи категорию сам.
- recommendations: ВСЕ явные рекомендации из текста, каждая отдельным элементом — контроль и повторные обследования, консультации специалистов, питание (например «увеличить потребление белка»), образ жизни и любые другие. text — дословная цитата из текста без изменений слов; kind — follow_up | consultation | diet | lifestyle | other. Не пропускай рекомендации, не связанные с BI-RADS. Если рекомендаций нет — пустой массив. Не придумывай и не добавляй своих рекомендаций. Не трактуй советы по питанию как лечение рака.
- questions: 3–5 нейтральных вопросов, которые можно задать врачу.
- personal_concern: true ТОЛЬКО если автор текста от первого лица описывает новое или текущее личное изменение (например «я нащупала уплотнение», «у меня появились выделения»). Описания врача и отрицания («образований не выявлено») — это false.
- Если текст не похож на медицинское заключение, честно скажи об этом в summary и оставь остальные поля пустыми.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "terms", "birads", "recommendations", "questions", "personal_concern"],
  properties: {
    summary: { type: "string" },
    terms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "explanation"],
        properties: { term: { type: "string" }, explanation: { type: "string" } },
      },
    },
    birads: { type: ["string", "null"] },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "kind"],
        properties: { text: { type: "string" }, kind: { type: "string", enum: ["follow_up", "consultation", "diet", "lifestyle", "other"] } },
      },
    },
    questions: { type: "array", items: { type: "string" } },
    personal_concern: { type: "boolean" },
  },
} as const;

type Raw = {
  summary: string;
  terms: { term: string; explanation: string }[];
  birads: string | null;
  recommendations: { text: string; kind: string }[];
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
      return {
        ok: true,
        result: {
          source: "ai",
          summary: raw.summary,
          terms: verifyTerms(data.text, raw.terms),
          birads: cat && key ? { category: cat, meaning: (BIRADS_MEANING as Record<string, string>)[key] ?? "" } : null,
          recommendations: buildRecommendations(data.text, raw.recommendations),
          questions: raw.questions.slice(0, 5),
          personalConcern: raw.personal_concern,
        },
      };
    } catch (e) {
      console.error("explainReport failed", e);
      return { ok: false, error: "AI-помощник сейчас недоступен. Попробуйте позже или откройте демо-пример." };
    }
  });
