// localStorage-backed persistence — everything here is a thin read/write layer around plain
// data the engine already knows how to compute (StatsMap, SessionSummary); no logic lives
// here beyond "load it," "save it," and "what's the best result on record for this config."
// Doubles as the local cache/fallback once cross-device sync is on (see network/sync.ts) —
// synced state is mirrored here too, so a reload shows something instantly instead of a blank
// screen while the live Firestore subscription catches up.
import { MultipleChoiceDifficulty, QuizCategory, QuizMode, StatsMap } from '@worldly/engine';

const STATS_KEY = 'worldlyStats';
const HISTORY_KEY = 'worldlySessionHistory';
const DAILY_CHALLENGE_KEY = 'worldlyDailyChallenge';
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

/** Same shape as loadStats/saveStats, just under a caller-chosen key — used by the seas/oceans
 * and US-states quizzes (see hooks/useGenericQuiz.ts), which each want their own independent
 * StatsMap (miss-tracking for the weighted order + weak-spots scope) rather than sharing
 * `worldlyStats`, whose ids are country ids from a completely different id space. Local-only
 * storage functions, same as loadStats/saveStats — but see network/sync.ts's SyncDoc.
 * waterBodyStats/usStateStats: these DO now go through the same cross-device sync pipeline
 * stats/history do, exactly like the country quiz, just kept in their own SyncDoc fields
 * instead of sharing `stats`/`history` (different id spaces, different item shapes). */
export function loadNamedStats(key: string): StatsMap {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StatsMap) : {};
  } catch {
    return {};
  }
}

export function saveNamedStats(key: string, stats: StatsMap): void {
  try {
    localStorage.setItem(key, JSON.stringify(stats));
  } catch {
    // ignore — see saveStats
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
  /** Always recorded, but only meaningful when `mode` is 'multipleChoice' (every other mode
   * just gets 'easy' here as a harmless default — see QuizConfig.multipleChoiceDifficulty).
   * Also part of the grouping key: an easy-mode run and a hard-mode run are genuinely different
   * challenges (hard's distractors are deliberately confusable), so they never collapse into
   * one record either. */
  multipleChoiceDifficulty: MultipleChoiceDifficulty;
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

/** The daily-challenge streak (see hooks/useQuiz.ts's completeDailyChallenge and
 * @worldly/engine's dailyCountry/dailyDateKey) — previously its own separate localStorage-only
 * feature (`useDailyChallenge.ts`, now folded into useQuiz), deliberately kept out of the synced
 * `stats`/`history` pipeline. Now part of the same synced SyncDoc those go through (see
 * network/sync.ts's SyncDoc.dailyChallenge) — living here alongside SessionRecord/StatsMap's own
 * persistence functions is what makes that possible, the same way SessionRecord already does. */
export interface DailyChallengeState {
  lastPlayedDateKey: string | null;
  lastPlayedCorrect: boolean | null;
  /** Consecutive days (ending at `lastPlayedDateKey`) with a CORRECT answer — a wrong answer or
   * a skipped day both reset it to 0, same "you have to actually keep it up" spirit as any other
   * daily-streak feature. */
  streak: number;
}

export const DEFAULT_DAILY_CHALLENGE_STATE: DailyChallengeState = { lastPlayedDateKey: null, lastPlayedCorrect: null, streak: 0 };

export function loadDailyChallengeState(): DailyChallengeState {
  try {
    const raw = localStorage.getItem(DAILY_CHALLENGE_KEY);
    return raw ? (JSON.parse(raw) as DailyChallengeState) : DEFAULT_DAILY_CHALLENGE_STATE;
  } catch {
    return DEFAULT_DAILY_CHALLENGE_STATE;
  }
}

export function saveDailyChallengeState(state: DailyChallengeState): void {
  try {
    localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(state));
  } catch {
    // ignore — see saveStats
  }
}

/** Reconciles two independently-grown copies of the daily-challenge streak — used the one time a
 * device connects to an existing sync code (see network/sync.ts's connectToSyncCode), same spirit
 * as mergeStatsMaps/mergeHistory but for a single running counter rather than a map/list: there's
 * no meaningful way to "add" two streaks together, so whichever device most recently actually
 * played is simply the authoritative one — a streak from a stale, out-of-date device isn't a
 * second data point to combine, it's just superseded information. */
export function mergeDailyChallengeState(a: DailyChallengeState, b: DailyChallengeState): DailyChallengeState {
  if (!a.lastPlayedDateKey) return b;
  if (!b.lastPlayedDateKey) return a;
  return a.lastPlayedDateKey >= b.lastPlayedDateKey ? a : b;
}

/** Unions two independently-grown history lists (same one-time use as the engine's
 * mergeStatsMaps — see that function's doc comment), deduped by id, newest first, capped to
 * the usual history limit. Structural rather than SessionRecord-specific (just needs `id` and
 * `completedAt`) so this also covers GenericSessionRecord below, the seas/oceans and US-states
 * quizzes' own history shape — SessionRecord already satisfies it. */
export function mergeHistory<T extends { id: string; completedAt: number }>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
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
  multipleChoiceDifficulty: string,
  scope: string,
  continentsKey: string,
): PersonalBest | null {
  const matches = history.filter(
    (h) =>
      h.mode === mode &&
      h.category === category &&
      h.multipleChoiceDifficulty === multipleChoiceDifficulty &&
      h.scope === scope &&
      h.continentsKey === continentsKey &&
      h.totalQuestions > 0,
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
  multipleChoiceDifficulty: SessionRecord['multipleChoiceDifficulty'];
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
    const key = `${record.mode}|${record.category}|${record.multipleChoiceDifficulty}|${record.scope}|${record.continentsKey}`;
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
        multipleChoiceDifficulty: records[0].multipleChoiceDifficulty,
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

// ---------- Seas/oceans + US-states quizzes: same shape as SessionRecord/PersonalBest/
// ConfigRecord above, just for GenericQuizItem-based sessions (genericSession.ts) instead of
// CountryDef ones. A smaller config surface (mode + scope + a plain string category, no
// continents/multiple-choice-difficulty) is the whole reason this isn't just reusing
// SessionRecord itself — most of its fields would be meaningless dead weight here.

export interface GenericSessionRecord {
  id: string;
  completedAt: number;
  mode: 'findIt' | 'typeIt';
  scope: 'all' | 'weakSpots';
  /** 'name' (or, for the water-bodies quiz, always 'name' — there's no category picker there)
   * plus, for the US-states quiz, 'flag' | 'capital'. Kept as a plain string rather than a
   * shared union with QuizCategory — country's 'country' vs. these quizzes' 'name' would be a
   * confusing near-duplicate of the same idea under a different name for no real benefit. */
  category: string;
  totalQuestions: number;
  correctCount: number;
  percentCorrect: number;
  totalElapsedMs: number;
}

export function loadGenericHistory(key: string): GenericSessionRecord[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as GenericSessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveGenericHistory(key: string, history: GenericSessionRecord[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // ignore — see saveStats
  }
}

export function appendGenericHistory(key: string, record: GenericSessionRecord): GenericSessionRecord[] {
  const history = [record, ...loadGenericHistory(key)].slice(0, MAX_HISTORY);
  saveGenericHistory(key, history);
  return history;
}

/** Same idea as personalBestFor, just keyed by (mode, scope, category) instead of the country
 * quiz's 5-field key — there's no continent/multiple-choice-difficulty dimension here. */
export function genericPersonalBestFor(history: GenericSessionRecord[], mode: string, scope: string, category: string): PersonalBest | null {
  const matches = history.filter((h) => h.mode === mode && h.scope === scope && h.category === category && h.totalQuestions > 0);
  if (matches.length === 0) return null;
  const best = matches.reduce((a, b) => (isBetterSession(b, a) ? b : a));
  return { percentCorrect: best.percentCorrect, totalElapsedMs: best.totalElapsedMs, totalQuestions: best.totalQuestions };
}

export interface GenericConfigRecord {
  mode: GenericSessionRecord['mode'];
  scope: Exclude<GenericSessionRecord['scope'], 'weakSpots'>;
  category: string;
  timesPlayed: number;
  bestPercentCorrect: number;
  bestTimeMs: number;
  bestTotalQuestions: number;
  lastPlayedAt: number;
}

/** Same idea as groupHistoryByConfig, just keyed by (mode, scope, category) — see that
 * function's doc comment for why 'weakSpots' sessions are excluded entirely. */
export function groupGenericHistoryByConfig(history: GenericSessionRecord[]): GenericConfigRecord[] {
  const groups = new Map<string, GenericSessionRecord[]>();
  for (const record of history) {
    if (record.totalQuestions === 0) continue;
    if (record.scope === 'weakSpots') continue;
    const key = `${record.mode}|${record.scope}|${record.category}`;
    const existing = groups.get(key);
    if (existing) existing.push(record);
    else groups.set(key, [record]);
  }
  return Array.from(groups.values())
    .map((records): GenericConfigRecord => {
      const best = records.reduce((a, b) => (isBetterSession(b, a) ? b : a));
      return {
        mode: records[0].mode,
        scope: records[0].scope as 'all', // never 'weakSpots' — filtered out above
        category: records[0].category,
        timesPlayed: records.length,
        bestPercentCorrect: best.percentCorrect,
        bestTimeMs: best.totalElapsedMs,
        bestTotalQuestions: best.totalQuestions,
        lastPlayedAt: Math.max(...records.map((r) => r.completedAt)),
      };
    })
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}
