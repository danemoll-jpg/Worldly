// Pure functions for turning quiz results into the persisted per-country track record. The
// client owns actually storing a StatsMap (localStorage) — everything here just computes the
// next value from the previous one, same "engine never touches persistence" separation as the
// rest of the series.
import { CountryStats, MasteryLevel, QuizAnswerResult, StatsMap } from './types.js';

export function applyResultToStats(statsMap: StatsMap, result: QuizAnswerResult, now: number = Date.now()): StatsMap {
  const prev = statsMap[result.countryId] ?? { countryId: result.countryId, seen: 0, missed: 0, lastSeenAt: null };
  const next: CountryStats = {
    countryId: result.countryId,
    seen: prev.seen + 1,
    missed: prev.missed + (result.correct ? 0 : 1),
    lastSeenAt: now,
  };
  return { ...statsMap, [result.countryId]: next };
}

export function applySessionToStats(statsMap: StatsMap, results: QuizAnswerResult[], now: number = Date.now()): StatsMap {
  return results.reduce((acc, result) => applyResultToStats(acc, result, now), statsMap);
}

/** Buckets a country's track record for the mastery map's coloring — 'new' (never quizzed),
 * 'struggling' (missed more often than not), 'shaky' (missed sometimes), 'solid' (rarely or
 * never missed). Thresholds are deliberately simple round numbers, not tuned against any real
 * data — reasonable defaults for "does this look about right," not a scored model. */
export function masteryLevel(stats: CountryStats | undefined): MasteryLevel {
  if (!stats || stats.seen === 0) return 'new';
  const ratio = stats.missed / stats.seen;
  if (ratio > 0.5) return 'struggling';
  if (ratio > 0.15) return 'shaky';
  return 'solid';
}
