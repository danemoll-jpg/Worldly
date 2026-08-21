import { describe, expect, it } from 'vitest';
import { isSessionComplete, skipCurrent, startSession, submitAnswer, summarizeSession } from '../src/session.js';
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
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: ['Europe'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    expect(state.pool.map((c) => c.id).sort()).toEqual(['de', 'fr']);
  });

  it('includes everything when continents is "all"', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    expect(state.pool).toHaveLength(4);
  });

  it('"weakSpots" scope only includes countries currently shaky/struggling by miss ratio', () => {
    const stats: StatsMap = {
      fr: { countryId: 'fr', seen: 3, missed: 1, lastSeenAt: null }, // ratio 0.33 — shaky
      de: { countryId: 'de', seen: 3, missed: 0, lastSeenAt: null }, // ratio 0 — solid
    };
    const config: QuizConfig = { mode: 'typeIt', category: 'country', continents: 'all', scope: 'weakSpots' };
    const state = startSession(config, POOL, stats, rng);
    expect(state.pool.map((c) => c.id)).toEqual(['fr']);
  });

  it('"weakSpots" scope drops a country once it\'s mastered since, even with old misses on record', () => {
    // One miss a long time ago, ten clean answers since — masteryLevel reads this as 'solid'
    // (ratio 1/11 ≈ 0.09, under the 0.15 shaky threshold), so it should no longer show up in a
    // weak-spots quiz even though `missed` is still a nonzero 1 in the lifetime stats. This is
    // exactly the "why is my weak-spots count higher than the mastery map's shaky+struggling
    // count" gap this scope is meant to have closed.
    const stats: StatsMap = {
      fr: { countryId: 'fr', seen: 11, missed: 1, lastSeenAt: null },
    };
    const config: QuizConfig = { mode: 'typeIt', category: 'country', continents: 'all', scope: 'weakSpots' };
    const state = startSession(config, POOL, stats, rng);
    expect(state.pool).toHaveLength(0);
  });

  it('starts with a null current question when the pool is empty', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: ['Oceania'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    expect(state.current).toBeNull();
    expect(isSessionComplete(state)).toBe(true);
  });
});

describe('submitAnswer + full session flow', () => {
  it('advances through every question and completes', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
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
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    const wrongId = POOL.find((c) => c.id !== state.current!.country.id)!.id;
    state = submitAnswer(state, { type: 'findIt', clickedCountryId: wrongId });
    expect(state.results[0].correct).toBe(false);
  });

  it('scores typeIt answers via lenient matching', () => {
    const config: QuizConfig = { mode: 'typeIt', category: 'country', continents: ['Europe'], scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    const target = state.current!.country; // France or Germany
    state = submitAnswer(state, { type: 'typeIt', submittedAnswer: target.name.toLowerCase() });
    expect(state.results[0].correct).toBe(true);
    expect(state.results[0].submittedAnswer).toBe(target.name.toLowerCase());
  });

  it("scores continent answers by comparing against the country's actual continent", () => {
    const config: QuizConfig = { mode: 'continent', category: 'country', continents: ['Europe'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);

    const right = submitAnswer(state, { type: 'continent', selectedContinent: 'Europe' });
    expect(right.results[0].correct).toBe(true);
    expect(right.results[0].submittedAnswer).toBe('Europe');

    const wrong = submitAnswer(state, { type: 'continent', selectedContinent: 'Asia' });
    expect(wrong.results[0].correct).toBe(false);
    expect(wrong.results[0].submittedAnswer).toBe('Asia');
  });

  it('is a no-op once the session is already complete', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: ['Oceania'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    const after = submitAnswer(state, { type: 'findIt', clickedCountryId: 'anything' });
    expect(after).toEqual(state);
  });
});

describe('skipCurrent', () => {
  it('moves the current question to the back without touching askedIds/results', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    const firstId = state.current!.country.id;

    state = skipCurrent(state);

    expect(state.current!.country.id).not.toBe(firstId);
    expect(state.askedIds).toEqual([]);
    expect(state.results).toEqual([]);
    // Nothing lost — same countries, just reordered, and the skipped one is now at the back.
    expect(state.remaining.map((c) => c.id).sort()).toEqual(state.pool.map((c) => c.id).sort());
    expect(state.remaining[state.remaining.length - 1].id).toBe(firstId);
  });

  it('the skipped country comes back around later in the same session', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    const skippedId = state.current!.country.id;
    state = skipCurrent(state);

    // Answer everything else first...
    while (state.current!.country.id !== skippedId) {
      state = submitAnswer(state, { type: 'findIt', clickedCountryId: state.current!.country.id });
    }
    // ...and the skipped country is still there, answerable, at the very end.
    expect(state.current!.country.id).toBe(skippedId);
    expect(isSessionComplete(state)).toBe(false);
    state = submitAnswer(state, { type: 'findIt', clickedCountryId: skippedId });
    expect(isSessionComplete(state)).toBe(true);
    expect(state.results.map((r) => r.countryId).sort()).toEqual(POOL.map((c) => c.id).sort());
  });

  it("doesn't total-question count or pool order — 'X of N' stays stable across skips", () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    const poolOrder = state.pool.map((c) => c.id);
    state = skipCurrent(state);
    state = skipCurrent(state);
    expect(state.pool.map((c) => c.id)).toEqual(poolOrder);
  });

  it('is a no-op with one question left (guarantees the session can always terminate)', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
    let state = startSession(config, POOL, {}, rng);
    while (state.remaining.length > 1) {
      state = submitAnswer(state, { type: 'findIt', clickedCountryId: state.current!.country.id });
    }
    const before = state;
    const after = skipCurrent(state);
    expect(after).toEqual(before);
  });

  it('is a no-op once the session is already complete', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: ['Oceania'], scope: 'all' };
    const state = startSession(config, POOL, {}, rng);
    expect(skipCurrent(state)).toEqual(state);
  });
});

describe('summarizeSession', () => {
  it('computes percentCorrect and totals', () => {
    const config: QuizConfig = { mode: 'findIt', category: 'country', continents: 'all', scope: 'all' };
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
