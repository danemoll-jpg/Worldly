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
  /** Almost always one entry — a few countries (South Africa, Bolivia, ...) have more than one
   * official capital, in which case this is every one of them, in the source data's own order.
   * `capitals[0]` is what the capitals quiz category shows/asks about and what any UI that only
   * has room for "the" capital uses; the atlas panel shows the full list. Never empty. */
  capitals: string[];
  /** Official/widely-spoken language names, unranked beyond the source data's own order — shown
   * in the atlas panel. Not currently used for quizzing. Never empty. */
  languages: string[];
  /** A single Unicode flag emoji (a regional-indicator pair) — used as-is by the flags quiz
   * category and the atlas panel, no image asset involved. */
  flagEmoji: string;
}

/** 'findIt': the country's named (or shown via `category` — see below), the player clicks/taps
 * it on the map. 'typeIt': the country's highlighted on the map, the player types its name —
 * untimed, leniently matched (see matching.ts). 'multipleChoice': same prompt as findIt, but
 * answered by picking one of 4 country-name buttons instead of tapping the map — a gentler
 * recognition mode than findIt (searching a full map of ~200 shapes) without going all the way
 * to typeIt's free recall. Answered with the exact same `{ type: 'findIt' }` Answer as findIt —
 * picking a button and tapping the right shape on the map mean the same thing to the engine, so
 * this needed no new Answer variant, just a new way for the CLIENT to collect one. 'continent':
 * the country's named, the player picks which of the 6 continents it's in from a short button
 * list — genuinely different from the other three (the answer is a continent, not a country),
 * so it doesn't cross with `category` the way the others do; a continent question always shows
 * the plain country name. */
export type QuizMode = 'findIt' | 'typeIt' | 'multipleChoice' | 'continent';

/** What's shown as the prompt for findIt/typeIt — the thing being asked about is always still
 * "which country is this", just presented a different way: 'country' (the name, the original
 * v1 behavior), 'flag' (just the flag emoji — "whose flag is this?"), or 'capital' (just
 * `capitals[0]` — "which country has this capital?"). Deliberately doesn't touch how the answer
 * is given or checked at all (see submitAnswer) — a flag/capital question is answered exactly
 * like a country-name one, just with a different prompt in front of it. Ignored when `mode` is
 * 'continent' (see QuizMode). */
export type QuizCategory = 'country' | 'flag' | 'capital';

/** 'all': every quizzable country (in the selected continents) appears once per session — the
 * "get through everything" mode. 'weakSpots': only countries with at least one past miss are
 * included — the "drill what I keep getting wrong" mode the rest of this file exists to
 * support. Both use the same miss-weighted ordering (see weighting.ts); the difference is only
 * which countries make it into the pool at all. */
export type QuizScope = 'all' | 'weakSpots';

export interface QuizConfig {
  mode: QuizMode;
  /** Always present, but only meaningful when `mode` is 'findIt', 'typeIt', or
   * 'multipleChoice' — ignored for 'continent'. Defaults to 'country' (the original v1 prompt)
   * wherever a config is built without deliberately choosing something else. */
  category: QuizCategory;
  /** Always present, but only meaningful when `mode` is 'multipleChoice' — ignored everywhere
   * else. 'easy': the 3 wrong options are random other countries from the pool. 'hard': they're
   * deliberately picked to be confusable — same continent as the target and/or similarly-spelled
   * names (Niger/Nigeria, Slovakia/Slovenia, Austria/Australia, ...), a genuinely harder pick
   * than plain random ever produces. See the client's pickChoices for the actual selection. */
  multipleChoiceDifficulty: MultipleChoiceDifficulty;
  continents: Continent[] | 'all';
  scope: QuizScope;
}

export type MultipleChoiceDifficulty = 'easy' | 'hard';

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
  /** Present for 'typeIt' (what was actually typed) and 'continent' (which continent was
   * picked) — absent for 'findIt', which has nothing worth echoing back beyond right/wrong.
   * Kept for the session summary (e.g. showing "you said X, it was Y" on a miss). */
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
