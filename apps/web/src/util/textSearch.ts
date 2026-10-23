/** Matching for the searchable pickers: accents, apostrophes, hyphens and case aside. */

/** "Lang’ata" → "langata", "Ọ̀yọ́" → "oyo", "Elgeyo-Marakwet" → "elgeyo marakwet". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘'`]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Whether `label` contains an already-normalised query. */
export function matchesSearch(label: string, normalizedQuery: string): boolean {
  return !normalizedQuery || normalizeSearch(label).includes(normalizedQuery);
}

/** How many matches a picker renders at once; typing narrows the rest. */
export const SEARCH_RESULT_LIMIT = 50;

export interface SearchResult<T> {
  hits: T[];
  /** Some matches were left out: keep typing. */
  more: boolean;
}

/**
 * A search over `options` (labels normalised once): labels containing the query,
 * exact names first, then word-prefix matches, at most `limit` of them.
 */
export function optionMatcher<T extends { label: string }>(options: readonly T[]) {
  const labels = options.map((option) => normalizeSearch(option.label));
  return (query: string, limit = SEARCH_RESULT_LIMIT): SearchResult<T> => {
    const q = normalizeSearch(query);
    if (!q) return { hits: options.slice(0, limit), more: options.length > limit };
    const exact: T[] = [];
    const leading: T[] = [];
    const inner: T[] = [];
    labels.forEach((label, index) => {
      if (label === q) exact.push(options[index]);
      else if (label.startsWith(q) || label.includes(` ${q}`)) leading.push(options[index]);
      else if (label.includes(q)) inner.push(options[index]);
    });
    const hits = [...exact, ...leading, ...inner];
    return { hits: hits.slice(0, limit), more: hits.length > limit };
  };
}
