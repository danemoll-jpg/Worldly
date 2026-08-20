// Core types for Worldly's quiz engine. Framework-free — no rendering, no DOM, no storage —
// so the exact same logic backs the quiz screens, the mastery map, and the test suite. There's
// no bot/opponent concept here (unlike the rest of the series): this is a solo study tool, so
// there's no legality/turn state machine to speak of, just "what's the next question, was the
// answer right, and how does that change what gets asked next."

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania';

export const CONTINENTS: readonly Continent[] = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

/** One quizzable sovereign country. `id` is the join key against the map's boundary geometry
 * (see packages/client — the map's shapes carry the same ids). `aliases` are additional
 * accepted answers for "type it" mode (alternate names, common abbreviations) — see
 * countries.ts's per-entry comments for why each alias is there. */
export interface CountryDef {
  id: string;
  name: string;
  continent: Continent;
  aliases?: string[];
}

/** 'findIt': the country's named, the player clicks/taps it on the map.
 * 'typeIt': the country's highlighted on the map, the player types its name — untimed,
 * leniently matched (see matching.ts). Deliberately just these two for v1; flags/capitals/etc.
 * are a different question shape that can slot in later without touching this type. */
export type QuizMode = 'findIt' | 'typeIt';

/** 'all': every quizzable country (in the selected continents) appears once per session — the
 * "get through everything" mode. 'weakSpots': only countries with at least one past miss are
 * included — the "drill what I keep getting wrong" mode the rest of this file exists to
 * support. Both use the same miss-weighted ordering (see weighting.ts); the difference is only
 * which countries make it into the pool at all. */
export type QuizScope = 'all' | 'weakSpots';

export interface QuizConfig {
  mode: QuizMode;
  continents: Continent[] | 'all';
  scope: QuizScope;
}

/** Running per-country record, persisted by the client (localStorage) across sessions —
 * everything in this file only ever reads/writes this shape, never the storage mechanism
 * itself. */
export interface CountryStats {
  countryId: string;
  seen: number;
  missed: number;
  lastSeenAt: number | null;
}

export type StatsMap = Record<string, CountryStats>;

export interface QuizQuestion {
  country: CountryDef;
  mode: QuizMode;
}

export interface QuizAnswerResult {
  countryId: string;
  correct: boolean;
  /** Only present for 'typeIt' — what the player actually typed, kept for the session summary
   * (e.g. showing "you typed X, it was Y" on a miss). */
  submittedAnswer?: string;
  elapsedMs: number;
}

/** The whole state of one quiz run — deliberately plain data (no class), same spirit as the
 * rest of the series' GameState: easy to snapshot, easy to test, easy to persist if the client
 * ever wants to resume a session. */
export interface QuizSessionState {
  config: QuizConfig;
  /** The full session order, decided once at session start (see session.ts's startSession) —
   * this is NOT re-shuffled as the session progresses, so "how many questions total" is known
   * from the very first question. */
  pool: CountryDef[];
  askedIds: string[];
  /** A mutable rotating queue of what's left to ask, separate from `pool`. Starts as a copy of
   * `pool` and shrinks by one from the front on every answer — but `skipCurrent` (session.ts)
   * can rotate its front entry to the back instead, so a skipped country comes back around
   * later in the same session without disturbing `pool`'s fixed order/count, which is what
   * progress display ("X of N") and the weighting logic rely on. */
  remaining: CountryDef[];
  /** The question currently on screen — null once `remaining` is empty. */
  current: QuizQuestion | null;
  results: QuizAnswerResult[];
  startedAt: number;
  /** When the current question was presented — null once the session is complete. Used only to
   * compute elapsedMs per question; there is no timer/deadline derived from this anywhere. */
  questionStartedAt: number | null;
}

export interface SessionSummary {
  totalQuestions: number;
  correctCount: number;
  /** 0-100, rounded — a stat to look back on, never a pass/fail gate. */
  percentCorrect: number;
  totalElapsedMs: number;
  results: QuizAnswerResult[];
}

export type MasteryLevel = 'new' | 'struggling' | 'shaky' | 'solid';
