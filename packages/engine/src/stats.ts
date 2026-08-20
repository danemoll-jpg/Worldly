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

/** Combines two independently-grown StatsMaps into one — used exactly once, the moment a
 * device first connects to cross-device sync (see the client's network/sync.ts), to fold
 * whatever progress that device made before syncing into the shared cloud copy without
 * dropping either side's history. `seen`/`missed` are simple counts, so summing them is
 * correct as long as this only ever runs on two maps that grew independently of each other —
 * once a device is syncing, all further updates go through the shared copy directly (see
 * applySessionToStats), so this never needs to run twice against the same data. */
export function mergeStatsMaps(a: StatsMap, b: StatsMap): StatsMap {
  const merged: StatsMap = { ...a };
  for (const [countryId, statsB] of Object.entries(b)) {
    const statsA = merged[countryId];
    merged[countryId] = statsA
      ? {
          countryId,
          seen: statsA.seen + statsB.seen,
          missed: statsA.missed + statsB.missed,
          lastSeenAt: Math.max(statsA.lastSeenAt ?? 0, statsB.lastSeenAt ?? 0) || null,
        }
      : statsB;
  }
  return merged;
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
