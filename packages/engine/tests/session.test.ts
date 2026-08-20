import { describe, expect, it } from 'vitest';
import { isSessionComplete, startSession, submitAnswer, summarizeSession } from '../src/session.js';
import { CountryDef, QuizConfig, StatsMap } from '../src/types.js';

const POOL: CountryDef[] = [
  { id: 'fr', name: 'France', continent: 'Europe' },
  { id: 'de', name: 'Germany', continent: 'Europe' },
  { id: 'jp', name: 'Japan', continent: 'Asia' },
  { id: 'br', name: 'Brazil', continent: 'South America' },
];

function rng() {
  return 0.5; // deterministic mid-roll, fine for structural tests that don't care about order
}

describe('startSession', () => {
  it('filters to the requested continents', () => {
    const config: QuizConfig = { mode: 'findIt', continents: ['Europe'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    expect(state.pool.map((c) => c.id).sort()).toEqual(['de', 'fr']);
  });

  it('includes everything when continents is "all"', () => {
    const config: QuizConfig = { mode: 'findIt', continents: 'all', scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    expect(state.pool).toHaveLength(4);
  });

  it('"weakSpots" scope only includes countries with at least one past miss', () => {
    const stats: StatsMap = {
      fr: { countryId: 'fr', seen: 3, missed: 1, lastSeenAt: null },
      de: { countryId: 'de', seen: 3, missed: 0, lastSeenAt: null },
    };
    const config: QuizConfig = { mode: 'typeIt', continents: 'all', scope: 'weakSpots' };
    const state = startSession(config, POOL, stats, rng);
    expect(state.pool.map((c) => c.id)).toEqual(['fr']);
  });

  it('starts with a null current question when the pool is empty', () => {
    const config: QuizConfig = { mode: 'findIt', continents: ['Oceania'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    expect(state.current).toBeNull();
    expect(isSessionComplete(state)).toBe(true);
  });
});

describe('submitAnswer + full session flow', () => {
  it('advances through every question and completes', () => {
    const config: QuizConfig = { mode: 'findIt', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng, 1000);
    expect(isSessionComplete(state)).toBe(false);

    let t = 1000;
    while (!isSessionComplete(state)) {
      const target = state.current!.country.id;
      t += 500;
      state = submitAnswer(state, { type: 'findIt', clickedCountryId: target }, t);
    }

    expect(state.results).toHaveLength(4);
    expect(state.askedIds).toHaveLength(4);
    expect(state.results.every((r) => r.correct)).toBe(true);
    expect(state.results.every((r) => r.elapsedMs === 500)).toBe(true);
  });

  it('records a miss when the wrong country is clicked', () => {
    const config: QuizConfig = { mode: 'findIt', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    const wrongId = POOL.find((c) => c.id !== state.current!.country.id)!.id;
    state = submitAnswer(state, { type: 'findIt', clickedCountryId: wrongId });
    expect(state.results[0].correct).toBe(false);
  });

  it('scores typeIt answers via lenient matching', () => {
    const config: QuizConfig = { mode: 'typeIt', continents: ['Europe'], scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    const target = state.current!.country; // France or Germany
    state = submitAnswer(state, { type: 'typeIt', submittedAnswer: target.name.toLowerCase() });
    expect(state.results[0].correct).toBe(true);
    expect(state.results[0].submittedAnswer).toBe(target.name.toLowerCase());
  });

  it('is a no-op once the session is already complete', () => {
    const config: QuizConfig = { mode: 'findIt', continents: ['Oceania'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    const after = submitAnswer(state, { type: 'findIt', clickedCountryId: 'anything' });
    expect(after).toEqual(state);
  });
});

describe('summarizeSession', () => {
  it('computes percentCorrect and totals', () => {
    const config: QuizConfig = { mode: 'findIt', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng, 0);
    // 3 correct, 1 wrong
    for (const country of state.pool.slice(0, 3)) {
      state = submitAnswer(state, { type: 'findIt', clickedCountryId: state.current!.country.id });
    }
    const wrongTarget = state.current!.country.id;
    const decoy = POOL.find((c) => c.id !== wrongTarget)!.id;
    state = submitAnswer(state, { type: 'findIt', clickedCountryId: decoy }, 9000);

    const summary = summarizeSession(state, 9000);
    expect(summary.totalQuestions).toBe(4);
    expect(summary.correctCount).toBe(3);
    expect(summary.percentCorrect).toBe(75);
    expect(summary.totalElapsedMs).toBe(9000);
  });
});
