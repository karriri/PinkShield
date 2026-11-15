import type { Recommendation } from "./report-safety";
export type Explanation = {
  summary: string;
  examType?: string | null;
  findings?: string[]; // verbatim from the report
  uncertainties?: string[]; // what is unclear or not stated
  terms: { term: string; explanation: string }[];
  birads: { category: string; meaning: string } | null;
  recommendations: Recommendation[]; // wording taken from the report, verified
  questions: string[];
  personalConcern: boolean; // user describes a new personal change (context-aware)
  source: "demo" | "ai";
};

export const BIRADS_MEANING =  {
  "0": "Обследование не завершено: врачу нужны дополнительные снимки или сравнение с прошлыми результатами.",
  "1": "Изменений не обнаружено.",
  "2": "Найдены доброкачественные изменения (например, простые кисты). Это не признак злокачественного процесса.",
  "3": "Изменения, вероятно, доброкачественные. Обычно врач предлагает контрольное наблюдение через определённый срок.",
  "4": "Есть изменения, которые требуют уточнения. Обычно врач обсуждает дополнительную диагностику, например биопсию. Это не диагноз.",
  "5": "Изменения с высокой степенью подозрения. Врач обязательно обсудит дальнейшие шаги. Окончательный ответ даёт только гистологическое исследование.",
  "6": "Категория для уже подтверждённого диагноза, по которому идёт лечение.",
} as const satisfies Record<string, string>;
