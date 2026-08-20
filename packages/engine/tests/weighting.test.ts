import { describe, expect, it } from 'vitest';
import { buildWeightedOrder, missRatio } from '../src/weighting.js';
import { CountryDef, StatsMap } from '../src/types.js';

const POOL: CountryDef[] = Array.from({ length: 12 }, (_, i) => ({
  id: `c${i}`,
  name: `Country ${i}`,
  continent: 'Europe',
}));

// Small deterministic LCG so the statistical test below is reproducible instead of flaky.
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('missRatio', () => {
  it('defaults never-seen countries to a moderate 0.5, not 0', () => {
    expect(missRatio(undefined)).toBe(0.5);
    expect(missRatio({ countryId: 'x', seen: 0, missed: 0, lastSeenAt: null })).toBe(0.5);
  });

  it('is missed/seen once there is history', () => {
    expect(missRatio({ countryId: 'x', seen: 4, missed: 1, lastSeenAt: null })).toBe(0.25);
    expect(missRatio({ countryId: 'x', seen: 3, missed: 3, lastSeenAt: null })).toBe(1);
  });
});

describe('buildWeightedOrder', () => {
  it('returns every country in the pool exactly once, in some order', () => {
    const order = buildWeightedOrder(POOL, {}, seededRng(1));
    expect(order).toHaveLength(POOL.length);
    expect(new Set(order.map((c) => c.id))).toEqual(new Set(POOL.map((c) => c.id)));
  });

  it('handles an empty pool', () => {
    expect(buildWeightedOrder([], {}, seededRng(1))).toEqual([]);
  });

  it('biases a consistently-missed country toward earlier positions on average', () => {
    const stats: StatsMap = { c0: { countryId: 'c0', seen: 10, missed: 10, lastSeenAt: null } };
    const trials = 400;
    let positionSum = 0;
    for (let i = 0; i < trials; i++) {
      const order = buildWeightedOrder(POOL, stats, seededRng(i + 1));
      positionSum += order.findIndex((c) => c.id === 'c0');
    }
    const averagePosition = positionSum / trials;
    // With no bias, average position across a 12-item pool would be ~5.5. A country missed
    // every time should land meaningfully earlier than that.
    expect(averagePosition).toBeLessThan(5.5 * 0.8);
  });
});
