// A small, reusable quiz-session engine for the quiz universes that AREN'T the country quiz —
// currently water bodies (oceans/seas) and US states. Deliberately not built on session.ts's
// QuizConfig/QuizSessionState/Answer types: those are shaped around country-quiz-specific
// concerns (continent filtering, a 'continent' answer mode, a `category` that swaps in a flag or
// capital as the prompt) that don't apply to either newer universe, and forcing them through the
// same types would mean bolting on fields that are meaningless most of the time (see QuizConfig's
// own doc comments about fields that are "ignored" depending on mode). Reuses matching.ts and
// stats.ts as-is — both already only care about an item's id/name/aliases (matching.ts) or a
// bare StatsMap keyed by id (stats.ts), not the concrete CountryDef shape — and duplicates
// weighting.ts's weighted-shuffle in miniature (same algorithm, `missRatio` imported directly)
// rather than widening that module's country-specific exports.
import { isAnswerCorrect, MatchableItem } from './matching.js';
import { masteryLevel } from './stats.js';
import { QuizAnswerResult, StatsMap } from './types.js';
import { missRatio } from './weighting.js';

export interface GenericQuizItem extends MatchableItem {
  id: string;
}

export type GenericQuizMode = 'findIt' | 'typeIt';

/** 'all': every item appears once per session. 'weakSpots': only items with at least one past
 * miss (same shaky/struggling definition the country quiz's mastery map uses — see
 * masteryLevel). Same idea as QuizScope, just not sharing its type since nothing else about
 * QuizConfig applies here. */
export type GenericQuizScope = 'all' | 'weakSpots';

export interface GenericSessionState<T extends GenericQuizItem> {
  mode: GenericQuizMode;
  /** Fixed at session start — see QuizSessionState.pool's doc comment for why this is kept
   * separate from `remaining`. */
  pool: T[];
  remaining: T[];
  current: T | null;
  askedIds: string[];
  results: QuizAnswerResult[];
  startedAt: number;
  questionStartedAt: number | null;
}

export type GenericAnswer = { type: 'findIt'; clickedId: string } | { type: 'typeIt'; submittedAnswer: string };

function filterPool<T extends GenericQuizItem>(items: T[], scope: GenericQuizScope, statsMap: StatsMap): T[] {
  if (scope === 'all') return items;
  return items.filter((item) => {
    const level = masteryLevel(statsMap[item.id]);
    return level === 'shaky' || level === 'struggling';
  });
}

/** Same weighted-random-permutation-without-replacement algorithm as weighting.ts's
 * buildWeightedOrder, just generic over `T extends GenericQuizItem` instead of CountryDef. */
function weightedOrder<T extends GenericQuizItem>(items: T[], statsMap: StatsMap, rng: () => number): T[] {
  const remaining = items.map((item) => ({ item, weight: 1 + missRatio(statsMap[item.id]) * 4 }));
  const order: T[] = [];
  while (remaining.length > 0) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng() * total;
    let pickIndex = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        pickIndex = i;
        break;
      }
    }
    order.push(remaining[pickIndex].item);
    remaining.splice(pickIndex, 1);
  }
  return order;
}

export function startGenericSession<T extends GenericQuizItem>(
  items: T[],
  mode: GenericQuizMode,
  scope: GenericQuizScope,
  statsMap: StatsMap,
  rng: () => number = Math.random,
  now: number = Date.now(),
): GenericSessionState<T> {
  const pool = weightedOrder(filterPool(items, scope, statsMap), statsMap, rng);
  return {
    mode,
    pool,
    remaining: [...pool],
    current: pool.length > 0 ? pool[0] : null,
    askedIds: [],
    results: [],
    startedAt: now,
    questionStartedAt: pool.length > 0 ? now : null,
  };
}

/** Scores the current question and advances to the next one (or ends the session if that was
 * the last question). No-ops if the session's already complete — same contract as session.ts's
 * submitAnswer. */
export function submitGenericAnswer<T extends GenericQuizItem>(
  state: GenericSessionState<T>,
  answer: GenericAnswer,
  now: number = Date.now(),
): GenericSessionState<T> {
  if (!state.current) return state;

  const elapsedMs = state.questionStartedAt ? Math.max(0, now - state.questionStartedAt) : 0;
  const target = state.current;
  const correct = answer.type === 'findIt' ? answer.clickedId === target.id : isAnswerCorrect(answer.submittedAnswer, target);

  const result: QuizAnswerResult = {
    countryId: target.id,
    correct,
    submittedAnswer: answer.type === 'typeIt' ? answer.submittedAnswer : undefined,
    elapsedMs,
  };

  const remaining = state.remaining.slice(1);
  const nextQuestion = remaining.length > 0 ? remaining[0] : null;

  return {
    ...state,
    askedIds: [...state.askedIds, target.id],
    remaining,
    results: [...state.results, result],
    current: nextQuestion,
    questionStartedAt: nextQuestion ? now : null,
  };
}

/** Defers the current question to the back of the queue instead of answering it — same contract
 * as session.ts's skipCurrent, including the "no-op with 0 or 1 remaining" termination
 * guarantee. */
export function skipGenericCurrent<T extends GenericQuizItem>(state: GenericSessionState<T>, now: number = Date.now()): GenericSessionState<T> {
  if (!state.current || state.remaining.length <= 1) return state;

  const [skipped, ...rest] = state.remaining;
  const remaining = [...rest, skipped];

  return {
    ...state,
    remaining,
    current: remaining[0],
    questionStartedAt: now,
  };
}

export function isGenericSessionComplete<T extends GenericQuizItem>(state: GenericSessionState<T>): boolean {
  return state.current === null;
}

export interface GenericSessionSummary {
  totalQuestions: number;
  correctCount: number;
  percentCorrect: number;
  totalElapsedMs: number;
  results: QuizAnswerResult[];
}

export function summarizeGenericSession<T extends GenericQuizItem>(state: GenericSessionState<T>, now: number = Date.now()): GenericSessionSummary {
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
