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
/** explicit = direct instruction; conditional = applies only "if/when"; uncertain = tentative wording. */
export type Certainty = "explicit" | "conditional" | "uncertain";
export type Recommendation = { text: string; kind: RecKind; passage?: string; certainty?: Certainty; explanation?: string };

export const REC_KIND_LABEL: Record<RecKind, string> = {
  follow_up: "Наблюдение и контроль", consultation: "Консультация специалиста", diet: "Питание", lifestyle: "Образ жизни", other: "Другие рекомендации",
};
export const CERTAINTY_NOTE: Record<Certainty, string> = {
  explicit: "",
  conditional: "Рекомендация с условием — относится к ситуации, описанной в тексте.",
  uncertain: "Формулировка неоднозначная — уточните у врача, что именно имеется в виду.",
};

export function classifyRecommendation(t: string): RecKind {
  const s = normalize(t);
  if (/бел(ок|ка|ковой)|питани|диет|рацион|продукт|витамин|клетчатк|жидкост|сахар|жирн/.test(s)) return "diet";
  if (/физическ|активност|\bсон\b|курени|алкогол|\bвес|стресс|прогулк|упражнен|бюстгальтер/.test(s)) return "lifestyle";
  if (/консультац|осмотр|при[её]м|маммолог|онколог|гинеколог|эндокринолог|врач|специалист/.test(s)) return "consultation";
  if (/контрол|повтор|через \d|мес|наблюдени|узи|маммограф|мрт|биопс|обследован/.test(s)) return "follow_up";
  return "other";
}

const NEGATED = /(не\s+(рекомендован|рекомендуется|показан|требуется|нужн|необходим)|нет\s+необходимости|противопоказан)/i;
const DESCRIPTIVE = /(рекомендуем(ая|ый|ое|ые|ой|ых)\s|следует\s+отметить|следует\s+учесть|как\s+рекомендовано\s+ранее|согласно\s+рекомендаци|ранее\s+рекомендован|была?\s+рекомендован|были\s+рекомендован)/i;
const CONDITIONAL = /(при\s+появлении|в\s+случае|при\s+необходимости|если\s|при\s+сохранении|при\s+увеличении|при\s+изменении)/i;
const UNCERTAIN = /(возможно|может\s+потребоваться|по\s+показаниям|рассмотреть|не\s+исключ|при\s+желании|желательно|целесообразно\s+обсудить)/i;
const MARKER = /(рекомендовано|рекомендуется|рекомендации?\s*:|рекомендую|показано|необходимо|следует|назначено|назначен[аы]?\b|желательно|целесообразно)/i;
const IMPERATIVE = /^(\s*[-•*\d.)]*\s*)(увеличить|уменьшить|ограничить|исключить|соблюдать|принимать|пройти|повторить|выполнить|обратиться|наблюдаться|контроль|консультация|динамическое наблюдение)/i;

export type StatementClass = Certainty | "negated" | "descriptive" | "plain";

/** Classify one source sentence. Only "explicit"/"conditional"/"uncertain" can become recommendations. */
export function classifyStatement(sentence: string): StatementClass {
  const s = sentence.trim();
  if (NEGATED.test(s)) return "negated";
  if (DESCRIPTIVE.test(s) && !/рекомендовано\s*:|рекомендуется\s*:|рекомендации\s*:/i.test(s)) return "descriptive";
  const hasMarker = MARKER.test(s) || IMPERATIVE.test(s);
  if (!hasMarker) return "plain";
  if (CONDITIONAL.test(s)) return "conditional";
  if (UNCERTAIN.test(s)) return "uncertain";
  return "explicit";
}

function sentences(source: string) {
  const text = source.replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2");
  const out: { s: string; inList: boolean }[] = [];
  let inList = false;
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) { inList = false; continue; }
    if (/^(рекомендаци[ия]|рекомендовано|рекомендуется)\s*:?\s*$/i.test(line)) { inList = true; continue; }
    for (const st of line.split(/(?<=[.!?])\s+/)) if (st.trim()) out.push({ s: st.trim(), inList: inList && /^[-•*\d]/.test(line) });
  }
  return out;
}

/** The full source sentence that contains a verified quote (kept as context for the user). */
export function passageFor(source: string, quote: string): string {
  const q = normalize(quote).replace(/[.;]+$/, "");
  const hit = sentences(source).find((x) => normalize(x.s).replace(/[«»"]/g, "").includes(q));
  return hit?.s ?? quote;
}

/** Deterministic safety net: explicit/conditional/uncertain recommendation sentences of the source. */
export function extractRecommendationLines(source: string): { text: string; passage: string; certainty: Certainty }[] {
  const out: { text: string; passage: string; certainty: Certainty }[] = [];
  for (const { s, inList } of sentences(source)) {
    let cls = classifyStatement(s);
    if (cls === "plain" && inList) cls = "explicit";
    if (cls === "negated" || cls === "descriptive" || cls === "plain") continue;
    const body = s.replace(/^.*?(рекомендовано|рекомендуется|рекомендации|рекомендация)\s*:\s*/i, "");
    for (const part of body.split(/;\s*/)) {
      const p = part.replace(/^[-•*\d.)\s]+/, "").replace(/[.;]+$/, "").trim();
      if (p.length >= 6) out.push({ text: p, passage: s, certainty: cls });
    }
  }
  return out;
}

/** Merge verified AI recommendations with deterministic ones; nothing absent from the source, no negations/descriptions. */
export function buildRecommendations(source: string, ai: { text: string; kind?: string; explanation?: string }[]): Recommendation[] {
  const res: Recommendation[] = [];
  const has = (t: string) => res.some((r) => normalize(r.text).includes(normalize(t)) || normalize(t).includes(normalize(r.text)));
  for (const a of ai) {
    const hit = locateQuote(source, a.text);
    if (!hit || has(hit)) continue;
    const passage = passageFor(source, hit);
    const cls = classifyStatement(passage);
    if (cls === "negated" || cls === "descriptive") continue;
    const kind = (REC_KINDS as readonly string[]).includes(a.kind ?? "") ? (a.kind as RecKind) : classifyRecommendation(hit);
    const r: Recommendation = { text: hit, kind, passage, certainty: cls !== "plain" ? cls : CONDITIONAL.test(passage) ? "conditional" : UNCERTAIN.test(passage) ? "uncertain" : "explicit" };
    if (a.explanation) r.explanation = a.explanation;
    res.push(r);
  }
  for (const line of extractRecommendationLines(source)) {
    if (!has(line.text)) res.push({ text: line.text, kind: classifyRecommendation(line.text), passage: line.passage, certainty: line.certainty });
  }
  return res;
}

/** Findings must appear in the source; returned in the source's wording. */
export function verifyFindings(source: string, findings: string[]): string[] {
  return verifyQuotes(source, findings);
}

export function detectExamType(source: string): string | null {
  const s = normalize(source);
  const found: string[] = [];
  if (/маммограф/.test(s)) found.push("Маммография");
  if (/(^|[^а-яё])узи([^а-яё]|$)|ультразвук|эхограф/.test(s)) found.push("УЗИ");
  if (/(^|[^а-яё])мрт([^а-яё]|$)|магнитно-резонанс/.test(s)) found.push("МРТ");
  if (/гистолог/.test(s)) found.push("Гистологическое исследование");
  return found.length ? found.join(", ") : null;
}
