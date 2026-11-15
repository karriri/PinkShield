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

/** Keep only recommendation quotes that are present (verbatim, normalized) in the source. */
export function verifyQuotes(source: string, quotes: string[]): string[] {
  const src = normalize(source);
  return quotes.filter((q) => {
    const n = normalize(q).replace(/[.;]+$/, "");
    return n.length >= 6 && src.includes(n);
  });
}

/** Keep only terms that literally appear in the source. */
export function verifyTerms<T extends { term: string }>(source: string, terms: T[]): T[] {
  const src = normalize(source);
  return terms.filter((t) => t.term.trim().length > 1 && src.includes(normalize(t.term)));
}
