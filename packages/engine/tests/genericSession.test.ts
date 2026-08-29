import { describe, expect, it } from 'vitest';
import {
  GenericQuizItem,
  isGenericSessionComplete,
  overrideLastGenericResultAsCorrect,
  skipGenericCurrent,
  startGenericSession,
  submitGenericAnswer,
  summarizeGenericSession,
} from '../src/genericSession.js';
import { StatsMap } from '../src/types.js';

const POOL: GenericQuizItem[] = [
  { id: 'pacific-ocean', name: 'Pacific Ocean' },
  { id: 'atlantic-ocean', name: 'Atlantic Ocean' },
  { id: 'indian-ocean', name: 'Indian Ocean', aliases: ['Indean Ocean'] },
  { id: 'arctic-ocean', name: 'Arctic Ocean' },
];

function rng() {
  return 0.5; // deterministic mid-roll, fine for structural tests that don't care about order
}

describe('startGenericSession', () => {
  it('includes everything with scope "all"', () => {
    const state = startGenericSession(POOL, 'findIt', 'all', {}, rng);
    expect(state.pool).toHaveLength(4);
  });

  it('"weakSpots" scope only includes items currently shaky/struggling by miss ratio', () => {
    const stats: StatsMap = {
      'pacific-ocean': { countryId: 'pacific-ocean', seen: 3, missed: 1, lastSeenAt: null }, // ratio 0.33 — shaky
      'atlantic-ocean': { countryId: 'atlantic-ocean', seen: 3, missed: 0, lastSeenAt: null }, // ratio 0 — solid
    };
    const state = startGenericSession(POOL, 'typeIt', 'weakSpots', stats, rng);
    expect(state.pool.map((i) => i.id)).toEqual(['pacific-ocean']);
  });

  it('starts with a null current question when the pool is empty', () => {
    const state = startGenericSession([], 'findIt', 'all', {}, rng);
    expect(state.current).toBeNull();
    expect(isGenericSessionComplete(state)).toBe(true);
  });
});

describe('submitGenericAnswer + full session flow', () => {
  it('advances through every question and completes', () => {
    let state = startGenericSession(POOL, 'findIt', 'all', {}, rng, 1000);
    expect(isGenericSessionComplete(state)).toBe(false);

    let t = 1000;
    while (!isGenericSessionComplete(state)) {
      const target = state.current!.id;
      t += 500;
      state = submitGenericAnswer(state, { type: 'findIt', clickedId: target }, t);
    }

    expect(state.results).toHaveLength(4);
    expect(state.askedIds).toHaveLength(4);
    expect(state.results.every((r) => r.correct)).toBe(true);
    expect(state.results.every((r) => r.elapsedMs === 500)).toBe(true);
  });

  it('records a miss when the wrong marker is tapped', () => {
    let state = startGenericSession(POOL, 'findIt', 'all', {}, rng);
    const wrongId = POOL.find((i) => i.id !== state.current!.id)!.id;
    state = submitGenericAnswer(state, { type: 'findIt', clickedId: wrongId });
    expect(state.results[0].correct).toBe(false);
  });

  it('scores typeIt answers via the same lenient matching the country quiz uses', () => {
    let state = startGenericSession(POOL, 'typeIt', 'all', {}, rng);
    const target = state.current!;
    state = submitGenericAnswer(state, { type: 'typeIt', submittedAnswer: target.name.toLowerCase() });
    expect(state.results[0].correct).toBe(true);
    expect(state.results[0].submittedAnswer).toBe(target.name.toLowerCase());
  });

  it('is a no-op once the session is already complete', () => {
    const state = startGenericSession([], 'findIt', 'all', {}, rng);
    const after = submitGenericAnswer(state, { type: 'findIt', clickedId: 'anything' });
    expect(after).toEqual(state);
  });
});

describe('overrideLastGenericResultAsCorrect', () => {
  it('flips the most recent wrong answer to correct', () => {
    let state = startGenericSession(POOL, 'findIt', 'all', {}, rng);
    const wrongId = POOL.find((i) => i.id !== state.current!.id)!.id;
    state = submitGenericAnswer(state, { type: 'findIt', clickedId: wrongId });
    expect(state.results[0].correct).toBe(false);

    const corrected = overrideLastGenericResultAsCorrect(state);
    expect(corrected.results[0].correct).toBe(true);
    expect(corrected.askedIds).toEqual(state.askedIds);
  });

  it('is a no-op when the last result was already correct', () => {
    let state = startGenericSession(POOL, 'findIt', 'all', {}, rng);
    state = submitGenericAnswer(state, { type: 'findIt', clickedId: state.current!.id });
    expect(overrideLastGenericResultAsCorrect(state)).toEqual(state);
  });

  it('is a no-op with no results yet', () => {
    const state = startGenericSession(POOL, 'findIt', 'all', {}, rng);
    expect(overrideLastGenericResultAsCorrect(state)).toEqual(state);
  });
});

describe('skipGenericCurrent', () => {
  it('moves the current question to the back without touching askedIds/results', () => {
    let state = startGenericSession(POOL, 'findIt', 'all', {}, rng);
    const firstId = state.current!.id;

    state = skipGenericCurrent(state);

    expect(state.current!.id).not.toBe(firstId);
    expect(state.askedIds).toEqual([]);
    expect(state.results).toEqual([]);
    expect(state.remaining[state.remaining.length - 1].id).toBe(firstId);
  });

  it('is a no-op with one question left (guarantees the session can always terminate)', () => {
    let state = startGenericSession(POOL, 'findIt', 'all', {}, rng);
    while (state.remaining.length > 1) {
      state = submitGenericAnswer(state, { type: 'findIt', clickedId: state.current!.id });
    }
    const before = state;
    const after = skipGenericCurrent(state);
    expect(after).toEqual(before);
  });
});

describe('summarizeGenericSession', () => {
  it('computes percentCorrect and totals', () => {
    let state = startGenericSession(POOL, 'findIt', 'all', {}, rng, 0);
    for (const _item of state.pool.slice(0, 3)) {
      state = submitGenericAnswer(state, { type: 'findIt', clickedId: state.current!.id });
    }
    const wrongTarget = state.current!.id;
    const decoy = POOL.find((i) => i.id !== wrongTarget)!.id;
    state = submitGenericAnswer(state, { type: 'findIt', clickedId: decoy }, 9000);

    const summary = summarizeGenericSession(state, 9000);
    expect(summary.totalQuestions).toBe(4);
    expect(summary.correctCount).toBe(3);
    expect(summary.percentCorrect).toBe(75);
    expect(summary.totalElapsedMs).toBe(9000);
  });
});
