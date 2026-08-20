// One quiz run: build the question order once at the start (region filter + scope, then
// miss-weighted shuffle), then step through it one answer at a time. Deliberately no timer or
// deadline anywhere in here — `elapsedMs` per question and `totalElapsedMs` for the session are
// recorded for the summary screen, never enforced.
import { isAnswerCorrect } from './matching.js';
import { masteryLevel } from './stats.js';
import {
  CountryDef,
  QuizAnswerResult,
  QuizConfig,
  QuizQuestion,
  QuizSessionState,
  SessionSummary,
  StatsMap,
} from './types.js';
import { buildWeightedOrder } from './weighting.js';

function filterPool(allCountries: CountryDef[], config: QuizConfig, statsMap: StatsMap): CountryDef[] {
  const byRegion =
    config.continents === 'all' ? allCountries : allCountries.filter((c) => config.continents.includes(c.continent));
  if (config.scope === 'weakSpots') {
    // Same 'shaky'/'struggling' definition the mastery map colors countries by (miss RATIO,
    // not a lifetime "ever missed once" flag) — so a country you mostly nailed since one early
    // slip reads as mastered on both screens, not stuck in this pool forever just because
    // `missed` never goes back down. See masteryLevel's own doc comment for the thresholds.
    return byRegion.filter((c) => {
      const level = masteryLevel(statsMap[c.id]);
      return level === 'shaky' || level === 'struggling';
    });
  }
  return byRegion;
}

export function startSession(
  config: QuizConfig,
  allCountries: CountryDef[],
  statsMap: StatsMap,
  rng: () => number = Math.random,
  now: number = Date.now(),
): QuizSessionState {
  const pool = buildWeightedOrder(filterPool(allCountries, config, statsMap), statsMap, rng);
  return {
    config,
    pool,
    askedIds: [],
    remaining: [...pool],
    current: pool.length > 0 ? { country: pool[0], mode: config.mode } : null,
    results: [],
    startedAt: now,
    questionStartedAt: pool.length > 0 ? now : null,
  };
}

export type Answer = { type: 'findIt'; clickedCountryId: string } | { type: 'typeIt'; submittedAnswer: string };

/** Scores the current question and advances to the next one (or ends the session if that was
 * the last question). No-ops if the session's already complete. */
export function submitAnswer(state: QuizSessionState, answer: Answer, now: number = Date.now()): QuizSessionState {
  if (!state.current) return state;

  const elapsedMs = state.questionStartedAt ? Math.max(0, now - state.questionStartedAt) : 0;
  const target = state.current.country;
  const correct = answer.type === 'findIt' ? answer.clickedCountryId === target.id : isAnswerCorrect(answer.submittedAnswer, target);

  const result: QuizAnswerResult = {
    countryId: target.id,
    correct,
    submittedAnswer: answer.type === 'typeIt' ? answer.submittedAnswer : undefined,
    elapsedMs,
  };

  const remaining = state.remaining.slice(1);
  const nextQuestion: QuizQuestion | null = remaining.length > 0 ? { country: remaining[0], mode: state.config.mode } : null;

  return {
    ...state,
    askedIds: [...state.askedIds, target.id],
    remaining,
    results: [...state.results, result],
    current: nextQuestion,
    questionStartedAt: nextQuestion ? now : null,
  };
}

/** Defers the current question: sends it to the back of the queue instead of answering it, and
 * presents whatever's now at the front instead. Not an answer — doesn't touch `askedIds` or
 * `results`, so it has no effect on stats, scoring, or the session's percent-correct. A no-op
 * when there's nothing else left to show instead (0 or 1 remaining), which also guarantees a
 * session always terminates even if skip is mashed repeatedly. */
export function skipCurrent(state: QuizSessionState, now: number = Date.now()): QuizSessionState {
  if (!state.current || state.remaining.length <= 1) return state;

  const [skipped, ...rest] = state.remaining;
  const remaining = [...rest, skipped];

  return {
    ...state,
    remaining,
    current: { country: remaining[0], mode: state.config.mode },
    questionStartedAt: now,
  };
}

export function isSessionComplete(state: QuizSessionState): boolean {
  return state.current === null;
}

export function summarizeSession(state: QuizSessionState, now: number = Date.now()): SessionSummary {
  const totalQuestions = state.results.length;
  const correctCount = state.results.filter((r) => r.correct).length;
  return {
    totalQuestions,
    correctCount,
    percentCorrect: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
    totalElapsedMs: Math.max(0, now - state.startedAt),
    results: state.results,
  };
}
