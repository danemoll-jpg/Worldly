// One quiz run: build the question order once at the start (region filter + scope, then
// miss-weighted shuffle), then step through it one answer at a time. Deliberately no timer or
// deadline anywhere in here — `elapsedMs` per question and `totalElapsedMs` for the session are
// recorded for the summary screen, never enforced.
import { isAnswerCorrect } from './matching.js';
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
    return byRegion.filter((c) => (statsMap[c.id]?.missed ?? 0) > 0);
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

  const askedIds = [...state.askedIds, target.id];
  const nextQuestion: QuizQuestion | null = state.pool[askedIds.length]
    ? { country: state.pool[askedIds.length], mode: state.config.mode }
    : null;

  return {
    ...state,
    askedIds,
    results: [...state.results, result],
    current: nextQuestion,
    questionStartedAt: nextQuestion ? now : null,
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
