// localStorage-backed persistence — everything here is a thin read/write layer around plain
// data the engine already knows how to compute (StatsMap, SessionSummary); no logic lives
// here beyond "load it," "save it," and "what's the best result on record for this config."
// Doubles as the local cache/fallback once cross-device sync is on (see network/sync.ts) —
// synced state is mirrored here too, so a reload shows something instantly instead of a blank
// screen while the live Firestore subscription catches up.
import { StatsMap } from '@worldly/engine';

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
  mode: 'findIt' | 'typeIt';
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

export interface PersonalBest {
  bestTimeMs: number | null;
  bestAccuracy: number | null;
}

/** Best-ever time and best-ever accuracy for sessions matching this exact config — the two
 * numbers shown as "your record" on the summary screen. Deliberately not a single combined
 * "best session" (fastest and most-accurate aren't always the same run), since either stat on
 * its own is meaningful to beat. */
export function personalBestFor(history: SessionRecord[], mode: string, scope: string, continentsKey: string): PersonalBest {
  const matches = history.filter(
    (h) => h.mode === mode && h.scope === scope && h.continentsKey === continentsKey && h.totalQuestions > 0,
  );
  if (matches.length === 0) return { bestTimeMs: null, bestAccuracy: null };
  return {
    bestTimeMs: Math.min(...matches.map((m) => m.totalElapsedMs)),
    bestAccuracy: Math.max(...matches.map((m) => m.percentCorrect)),
  };
}

/** One row of the records screen — every distinct (mode, scope, region) combination the player
 * has actually completed at least once, each with its own personal bests. There's no single
 * "top score" for the app as a whole: a full-world find-it run and a weak-spots-only type-it
 * run aren't comparable, so this is deliberately a list of separate records, not one number. */
export interface ConfigRecord {
  mode: SessionRecord['mode'];
  scope: SessionRecord['scope'];
  continentsKey: string;
  timesPlayed: number;
  bestTimeMs: number;
  bestAccuracy: number;
  lastPlayedAt: number;
}

/** Groups history into one ConfigRecord per distinct config actually played, newest-played
 * first — the natural order for "what have I been doing lately," and stable even as new
 * sessions keep getting prepended to `history`. */
export function groupHistoryByConfig(history: SessionRecord[]): ConfigRecord[] {
  const groups = new Map<string, SessionRecord[]>();
  for (const record of history) {
    if (record.totalQuestions === 0) continue; // same guard personalBestFor uses
    const key = `${record.mode}|${record.scope}|${record.continentsKey}`;
    const existing = groups.get(key);
    if (existing) existing.push(record);
    else groups.set(key, [record]);
  }
  return Array.from(groups.values())
    .map((records): ConfigRecord => ({
      mode: records[0].mode,
      scope: records[0].scope,
      continentsKey: records[0].continentsKey,
      timesPlayed: records.length,
      bestTimeMs: Math.min(...records.map((r) => r.totalElapsedMs)),
      bestAccuracy: Math.max(...records.map((r) => r.percentCorrect)),
      lastPlayedAt: Math.max(...records.map((r) => r.completedAt)),
    }))
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}
