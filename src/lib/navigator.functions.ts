import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRewrite } from "./guidance-check";

async function ask(instructions: string, input: string) {
  const { generateResponse } = await import("@lovable.dev/ai-gateway");
  const res = (await generateResponse({ model: "openai/gpt-6-astra", instructions, input: [{ role: "user", content: input }] })) as unknown as {
    output_text?: string; output?: { type: string; content?: { type: string; text?: string }[] }[];
  };
  return res.output_text ?? (res.output ?? []).flatMap((o) => (o.type === "message" ? (o.content ?? []) : [])).map((c) => c.text ?? "").join("");
}

/** Optional plain-language rewrite of one approved statement. Falls back to the original text on any doubt. */
export const simplifyGuidance = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ statement: z.string().min(10).max(2000) }).parse(d))
  .handler(async ({ data }): Promise<{ text: string; simplified: boolean }> => {
    try {
      const rewrite = (await ask(
        "Перескажи утверждённый медицинский текст проще, спокойным русским языком, 1–3 предложения. Не добавляй новых чисел, возрастов, сроков, указаний, диагнозов, оценок риска или успокоений. Ничего не убирай из важного. Верни только текст.",
        data.statement,
      )).trim();
      if (!checkRewrite(data.statement, rewrite).ok) return { text: data.statement, simplified: false };
      const verdict = (await ask(
        "Сравни ОРИГИНАЛ и ПЕРЕСКАЗ. Ответь одним словом YES, если пересказ сохраняет смысл и не добавляет и не убирает указаний, сроков, возрастов или выводов; иначе NO.",
        `ОРИГИНАЛ:\n${data.statement}\n\nПЕРЕСКАЗ:\n${rewrite}`,
      )).trim().toUpperCase();
      if (!verdict.startsWith("YES")) return { text: data.statement, simplified: false };
      return { text: rewrite, simplified: true };
    } catch (e) {
      console.error("simplifyGuidance failed", e);
      return { text: data.statement, simplified: false };
    }
  });
