// Distractor selection for the multiple-choice quiz mode — kept separate from QuizScreen since
// it's a real, independently-reasoned-about algorithm, not just view logic.
import { CountryDef, MultipleChoiceDifficulty } from '@worldly/engine';

const OPTION_COUNT = 4;

/** Standard Levenshtein edit distance — same algorithm the engine's matching.ts uses for typo
 * tolerance, but deliberately a separate copy: that one measures "is this typo forgivable",
 * this one measures "would a real person mix these two COUNTRIES up" for hard-mode distractor
 * selection, a different question that happens to reuse the same string-distance primitive. */
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

/** How "confusable" `candidate` is with `target` for hard-mode distractor purposes — higher is
 * more confusable. Same continent is worth more than name similarity alone (Niger and Zambia
 * don't look alike but both being landlocked African nations makes them a genuinely harder pair
 * to keep straight than name-similarity captures on its own); name closeness is normalized by
 * the longer name's length so a short name isn't unfairly penalized against a long one for the
 * same raw edit count. */
function confusability(target: CountryDef, candidate: CountryDef): number {
  const sameContinent = candidate.continent === target.continent ? 1.5 : 0;
  const maxLen = Math.max(target.name.length, candidate.name.length) || 1;
  const nameCloseness = 1 - levenshtein(target.name.toLowerCase(), candidate.name.toLowerCase()) / maxLen;
  return sameContinent + nameCloseness;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

/** Picks the target plus up to 3 distractors from the rest of the session's own pool (so
 * distractors are always relevant to whatever region/scope was chosen), shuffled together.
 * Falls back to fewer than 4 options gracefully — a heavily filtered quiz (one continent) can
 * legitimately have fewer than 4 countries in it at all.
 *
 * 'easy': distractors are uniformly random. 'hard': ranks every candidate by confusability (see
 * above) and draws from the most-confusable slice, with just enough randomness in which exact
 * ones get picked that the same target doesn't show the identical trio of options every time. */
export function pickChoices(target: CountryDef, pool: CountryDef[], difficulty: MultipleChoiceDifficulty): CountryDef[] {
  const others = pool.filter((c) => c.id !== target.id);
  const distractorCount = Math.min(OPTION_COUNT - 1, others.length);

  let distractors: CountryDef[];
  if (difficulty === 'hard') {
    const ranked = [...others].sort((a, b) => confusability(target, b) - confusability(target, a));
    // Draw from a pool a bit larger than what's needed so the exact trio still varies between
    // attempts at the same question, without ever reaching into the genuinely-easy tail.
    const candidatePool = ranked.slice(0, Math.max(distractorCount, Math.min(ranked.length, distractorCount * 3)));
    distractors = shuffle(candidatePool).slice(0, distractorCount);
  } else {
    distractors = shuffle(others).slice(0, distractorCount);
  }

  return shuffle([target, ...distractors]);
}
