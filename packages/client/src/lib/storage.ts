// localStorage-backed persistence — everything here is a thin read/write layer around plain
// data the engine already knows how to compute (StatsMap, SessionSummary); no logic lives
// here beyond "load it," "save it," and "what's the best result on record for this config."
// Doubles as the local cache/fallback once cross-device sync is on (see network/sync.ts) —
// synced state is mirrored here too, so a reload shows something instantly instead of a blank
// screen while the live Firestore subscription catches up.
import { QuizCategory, QuizMode, StatsMap } from '@worldly/engine';

const STATS_KEY = 'worldlyStats';
const HISTORY_KEY = 'worldlySessionHistory';
export const MAX_HISTORY = 200;

export function loadStats(): StatsMap {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? (JSON.parse(raw) as StatsMap) : {};
  } catch {
    return {};
  }
}

export function saveStats(stats: StatsMap): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // localStorage unavailable (private browsing, etc.) — stats just won't persist, no worse
    // than before this feature existed.
  }
}

export interface SessionRecord {
  /** Unique per record — lets history merge across devices (see network/sync.ts) dedupe
   * reliably instead of guessing from completedAt alone. */
  id: string;
  completedAt: number;
  mode: QuizMode;
  /** Always recorded, but only meaningful when `mode` is 'findIt' or 'typeIt' (continent-mode
   * sessions just get 'country' here as a harmless default — see QuizConfig.category). Part of
   * the grouping key everywhere history gets grouped by config, so a flags run and a plain
   * country-name run over the same region never collapse into one record. */
  category: QuizCategory;
  scope: 'all' | 'weakSpots';
  /** 'all' or a comma-joined, sorted list of continents — just a stable key for grouping
   * "personal best" comparisons by config, not shown verbatim anywhere. */
  continentsKey: string;
  totalQuestions: number;
  correctCount: number;
  percentCorrect: number;
  totalElapsedMs: number;
}

export function newSessionRecordId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: SessionRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // ignore — see saveStats
  }
}

export function appendHistory(record: SessionRecord): SessionRecord[] {
  const history = [record, ...loadHistory()].slice(0, MAX_HISTORY);
  saveHistory(history);
  return history;
}

/** Unions two independently-grown history lists (same one-time use as the engine's
 * mergeStatsMaps — see that function's doc comment), deduped by id, newest first, capped to
 * the usual history limit. */
export function mergeHistory(a: SessionRecord[], b: SessionRecord[]): SessionRecord[] {
  const byId = new Map<string, SessionRecord>();
  for (const record of [...a, ...b]) byId.set(record.id, record);
  return Array.from(byId.values())
    .sort((x, y) => y.completedAt - x.completedAt)
    .slice(0, MAX_HISTORY);
}

/** Ranks two sessions against each other — accuracy first, time only as a tiebreaker. Percent
 * is the primary signal deliberately: it's meaningful regardless of how many countries were in
 * play, where time isn't — a weak-spots pool shrinks as you improve and grows as you rack up
 * new misses, so "who finished faster" between two runs against different-sized pools isn't
 * really comparable, but "who got a higher percentage" still roughly is. Time only ever breaks
 * a tie in percent, so a 20-country run and a 3-country run at the same 100% never get ranked
 * against each other by speed alone. */
export function isBetterSession(
  a: { percentCorrect: number; totalElapsedMs: number },
  b: { percentCorrect: number; totalElapsedMs: number },
): boolean {
  if (a.percentCorrect !== b.percentCorrect) return a.percentCorrect > b.percentCorrect;
  return a.totalElapsedMs < b.totalElapsedMs;
}

export interface PersonalBest {
  percentCorrect: number;
  totalElapsedMs: number;
  /** How many countries that best run covered — shown alongside it (see RecordsScreen) since,
   * especially for weak-spots quizzes, the pool size isn't fixed and matters for reading the
   * number honestly. */
  totalQuestions: number;
}

/** The single best-ever session for this exact config, ranked by isBetterSession — deliberately
 * ONE record, not independent best-time/best-accuracy numbers, so "your record" always names an
 * actual run that happened rather than a Frankenstein of your fastest run's time and your
 * best-ever run's accuracy mashed together. */
export function personalBestFor(
  history: SessionRecord[],
  mode: string,
  category: string,
  scope: string,
  continentsKey: string,
): PersonalBest | null {
  const matches = history.filter(
    (h) =>
      h.mode === mode && h.category === category && h.scope === scope && h.continentsKey === continentsKey && h.totalQuestions > 0,
  );
  if (matches.length === 0) return null;
  const best = matches.reduce((a, b) => (isBetterSession(b, a) ? b : a));
  return { percentCorrect: best.percentCorrect, totalElapsedMs: best.totalElapsedMs, totalQuestions: best.totalQuestions };
}

/** One row of the records screen — every distinct (mode, scope, region) combination the player
 * has actually completed at least once, each with its own single best session. There's no one
 * "top score" for the app as a whole: a full-world find-it run and a weak-spots-only type-it
 * run aren't comparable, so this is deliberately a list of separate records, not one number.
 * Never a 'weakSpots' scope — see groupHistoryByConfig. */
export interface ConfigRecord {
  mode: SessionRecord['mode'];
  category: SessionRecord['category'];
  scope: Exclude<SessionRecord['scope'], 'weakSpots'>;
  continentsKey: string;
  timesPlayed: number;
  bestPercentCorrect: number;
  bestTimeMs: number;
  bestTotalQuestions: number;
  lastPlayedAt: number;
}

/** Groups history into one ConfigRecord per distinct config actually played, newest-played
 * first — the natural order for "what have I been doing lately," and stable even as new
 * sessions keep getting prepended to `history`. Excludes 'weakSpots' sessions entirely: the
 * pool of countries in a weak-spots quiz isn't fixed the way a region is — it shrinks as you
 * improve and grows as you rack up new misses — so even showing time as a mere tiebreaker/
 * context field next to the accuracy is misleading (a 3-country pool's time and a 20-country
 * pool's time from a different week aren't the same measurement). Rather than caveat that on
 * every weak-spots row, it's simplest and most honest to just not track a "record" for it. */
export function groupHistoryByConfig(history: SessionRecord[]): ConfigRecord[] {
  const groups = new Map<string, SessionRecord[]>();
  for (const record of history) {
    if (record.totalQuestions === 0) continue; // same guard personalBestFor uses
    if (record.scope === 'weakSpots') continue;
    const key = `${record.mode}|${record.category}|${record.scope}|${record.continentsKey}`;
    const existing = groups.get(key);
    if (existing) existing.push(record);
    else groups.set(key, [record]);
  }
  return Array.from(groups.values())
    .map((records): ConfigRecord => {
      const best = records.reduce((a, b) => (isBetterSession(b, a) ? b : a));
      return {
        mode: records[0].mode,
        category: records[0].category,
        scope: records[0].scope as 'all', // never 'weakSpots' — filtered out above
        continentsKey: records[0].continentsKey,
        timesPlayed: records.length,
        bestPercentCorrect: best.percentCorrect,
        bestTimeMs: best.totalElapsedMs,
        bestTotalQuestions: best.totalQuestions,
        lastPlayedAt: Math.max(...records.map((r) => r.completedAt)),
      };
    })
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}
