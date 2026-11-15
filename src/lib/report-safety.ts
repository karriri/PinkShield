/** Normalize text for containment checks (case, whitespace, ё, punctuation spacing). */
export function normalize(s: string) {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[«»"“”]/g, "").replace(/\s+/g, " ").trim();
}

/** BI-RADS categories explicitly written in the source text, e.g. "BI-RADS 2", "BIRADS: 4a". */
export function extractBiradsFromText(text: string): string[] {
  const re = /bi[\s-]?rads[\s:–-]*(?:категори[яи]\s*)?([0-6][abcабв]?)/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) found.add((m[1] ?? "").toUpperCase().replace("А", "A").replace("Б", "B").replace("В", "C"));
  return [...found];
}

/** Keep only a BI-RADS value that literally appears in the source; otherwise null. */
export function verifyBirads(source: string, claimed: string | null | undefined): string | null {
  if (!claimed) return null;
  const c = claimed.toUpperCase().replace(/BI[\s-]?RADS[\s:]*/i, "").trim();
  return extractBiradsFromText(source).includes(c) ? c : null;
}

/** Letters/digits only, lowercased, single spaces; keeps a map back to source offsets. */
function skeleton(s: string) {
  const src = s.replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2"); // undo line-break hyphenation
  let out = "";
  const map: number[] = [];
  let space = true;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!.toLowerCase().replace("ё", "е");
    if (/[\p{L}\p{N}]/u.test(ch)) { out += ch; map.push(i); space = false; }
    else if (!space) { out += " "; map.push(i); space = true; }
  }
  return { src, out: out.trimEnd(), map };
}

/** Find a quote in the source ignoring punctuation/case/line breaks; return the source's own wording, or null. */
export function locateQuote(source: string, quote: string): string | null {
  const s = skeleton(source);
  const q = skeleton(quote).out.trim();
  if (q.length < 6) return null;
  const at = s.out.indexOf(q);
  if (at < 0) return null;
  const start = s.map[at]!;
  const end = s.map[at + q.length - 1]! + 1;
  return s.src.slice(start, end).replace(/\s+/g, " ").trim();
}

/** Keep only recommendation quotes present in the source (tolerant matching), in the source's wording. */
export function verifyQuotes(source: string, quotes: string[]): string[] {
  const out: string[] = [];
  for (const q of quotes) {
    const hit = locateQuote(source, q);
    if (hit && !out.some((o) => normalize(o) === normalize(hit))) out.push(hit);
  }
  return out;
}

/** Keep only terms that literally appear in the source. */
export function verifyTerms<T extends { term: string }>(source: string, terms: T[]): T[] {
  const src = normalize(source);
  return terms.filter((t) => t.term.trim().length > 1 && src.includes(normalize(t.term)));
}

export const REC_KINDS = ["follow_up", "consultation", "diet", "lifestyle", "other"] as const;
export type RecKind = (typeof REC_KINDS)[number];
export type Recommendation = { text: string; kind: RecKind };

export const REC_KIND_LABEL: Record<RecKind, string> = {
  follow_up: "Наблюдение и контроль", consultation: "Консультация", diet: "Питание", lifestyle: "Образ жизни", other: "Другое",
};

export function classifyRecommendation(t: string): RecKind {
  const s = normalize(t);
  if (/бел(ок|ка|ковой)|питани|диет|рацион|продукт|витамин|клетчатк|жидкост|сахар|жирн/.test(s)) return "diet";
  if (/физическ|активност|сон|курени|алкогол|вес|стресс|прогулк|упражнен|бюстгальтер/.test(s)) return "lifestyle";
  if (/консультац|осмотр|приём|прием|маммолог|онколог|гинеколог|эндокринолог|врач/.test(s)) return "consultation";
  if (/контрол|повтор|через \d|мес|наблюдени|узи|маммограф|мрт|биопс|обследован/.test(s)) return "follow_up";
  return "other";
}

const MARKER = /(рекомендован|рекомендуется|рекомендаци|рекомендую|показан[оа]?\b|следует|необходимо|желательно|целесообразн|назначен)/i;
const IMPERATIVE = /^(\s*[-•*\d.)]*\s*)(увеличить|уменьшить|ограничить|исключить|соблюдать|принимать|пройти|повторить|выполнить|обратиться|наблюдаться|контрол)/i;

/**
 * Deterministic safety net: sentences/list items of the source that are explicit recommendations.
 * Ensures valid recommendations (diet, lifestyle, follow-up…) are never silently lost.
 */
export function extractRecommendationLines(source: string): string[] {
  const out: string[] = [];
  const lines = source.replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2").split(/\n/);
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { inList = false; continue; }
    const heading = /^(рекомендаци[ия]|рекомендовано|рекомендуется)\s*:?\s*$/i.test(line);
    if (heading) { inList = true; continue; }
    for (const sentence of line.split(/(?<=[.;!?])\s+/)) {
      const st = sentence.trim();
      const body = st.replace(/^(рекомендовано|рекомендуется|рекомендации|рекомендация)\s*:\s*/i, "");
      if (MARKER.test(st) || IMPERATIVE.test(st) || (inList && /^[-•*\d]/.test(st))) {
        for (const part of body.split(/;\s*/)) {
          const p = part.replace(/^[-•*\d.)\s]+/, "").replace(/[.;]+$/, "").trim();
          if (p.length >= 6 && !/^не (выявлен|обнаружен)/i.test(p)) out.push(p);
        }
      }
    }
  }
  return out;
}

/** Merge verified AI recommendations with deterministic ones; no duplicates, nothing absent from source. */
export function buildRecommendations(source: string, ai: { text: string; kind?: string }[]): Recommendation[] {
  const res: Recommendation[] = [];
  const has = (t: string) => res.some((r) => normalize(r.text).includes(normalize(t)) || normalize(t).includes(normalize(r.text)));
  for (const a of ai) {
    const hit = locateQuote(source, a.text);
    if (!hit || has(hit)) continue;
    const kind = (REC_KINDS as readonly string[]).includes(a.kind ?? "") ? (a.kind as RecKind) : classifyRecommendation(hit);
    res.push({ text: hit, kind });
  }
  for (const line of extractRecommendationLines(source)) if (!has(line)) res.push({ text: line, kind: classifyRecommendation(line) });
  return res;
}
