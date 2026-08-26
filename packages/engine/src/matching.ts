// Lenient answer matching for "type it" mode. Countries commonly have more than one legitimate
// name ("USA" vs. "United States," "Czechia" vs. "Czech Republic") — see each entry's
// `aliases` in countries.ts — and typing under untimed pressure still produces the occasional
// typo, so exact-string matching would be unfair in both directions. This normalizes case,
// accents, and punctuation, then accepts a small edit-distance tolerance scaled to word length.

/** Structural rather than `CountryDef` so this also covers the newer non-country quiz universes
 * (water bodies, US states — see genericSession.ts) that need the exact same lenient matching
 * but aren't countries. Any `{name, aliases?}` shape works — CountryDef already satisfies it. */
export interface MatchableItem {
  name: string;
  aliases?: string[];
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (e.g. é -> e)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation -> space (apostrophes, hyphens, periods)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Standard Levenshtein edit distance (insertions/deletions/substitutions). Country names are
 * short enough (a handful of words at most) that the classic O(n*m) DP table is plenty fast —
 * no need for anything cleverer here. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost));
    }
    prev = row;
  }
  return prev[b.length];
}

/** How many edits to forgive, scaled to the (normalized) target's length — a one-letter slip
 * on "Chad" would be nearly a different word, but the same slip on "Mozambique" is clearly just
 * a typo. */
function tolerance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

/** True if `submitted` is a reasonable answer for `item` — an exact match (after
 * normalizing) against its name or any alias, or a near-match within typo tolerance. */
export function isAnswerCorrect(submitted: string, item: MatchableItem): boolean {
  const norm = normalize(submitted);
  if (!norm) return false;

  const candidates = [item.name, ...(item.aliases ?? [])].map(normalize);
  if (candidates.includes(norm)) return true;

  return candidates.some((candidate) => {
    // Guard against near-misses on totally different words that just happen to be similar
    // length ("Chad" vs. "Chile" is 3 edits at length 4-5 — should never pass; this length
    // gate keeps the edit-distance check from being generous enough to accept that).
    if (Math.abs(candidate.length - norm.length) > 3) return false;
    return levenshtein(norm, candidate) <= tolerance(candidate.length);
  });
}
