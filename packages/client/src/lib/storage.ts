// localStorage-backed persistence — everything here is a thin read/write layer around plain
// data the engine already knows how to compute (StatsMap, SessionSummary); no logic lives
// here beyond "load it," "save it," and "what's the best result on record for this config."
import { StatsMap } from '@worldly/engine';

const STATS_KEY = 'worldlyStats';
const HISTORY_KEY = 'worldlySessionHistory';
const MAX_HISTORY = 200;

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

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function appendHistory(record: SessionRecord): SessionRecord[] {
  const history = [record, ...loadHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore — see saveStats
  }
  return history;
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
