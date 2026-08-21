import { describe, expect, it } from 'vitest';
import { CountryDef } from '../src/types.js';
import { dailyCountry, dailyDateKey } from '../src/dailyChallenge.js';

const POOL: CountryDef[] = [
  { id: 'a', name: 'Alpha', continent: 'Europe', capitals: ['A City'], languages: ['Alphese'], flagEmoji: '🇦🇦' },
  { id: 'b', name: 'Beta', continent: 'Europe', capitals: ['B City'], languages: ['Betan'], flagEmoji: '🇧🇧' },
  { id: 'c', name: 'Gamma', continent: 'Europe', capitals: ['C City'], languages: ['Gammic'], flagEmoji: '🇨🇨' },
];

describe('dailyDateKey', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(dailyDateKey(new Date(2026, 2, 5))).toBe('2026-03-05'); // March is month index 2
  });
});

describe('dailyCountry', () => {
  it('is deterministic — same date key always picks the same country', () => {
    const a = dailyCountry(POOL, '2026-01-01');
    const b = dailyCountry(POOL, '2026-01-01');
    expect(a.id).toBe(b.id);
  });

  it('different dates can (and generally do) pick different countries', () => {
    const ids = new Set(
      ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07'].map(
        (key) => dailyCountry(POOL, key).id,
      ),
    );
    // Not a strict guarantee for every possible input, but with a 3-country pool and 7 distinct
    // dates it would be suspicious if the hash never varied at all.
    expect(ids.size).toBeGreaterThan(1);
  });

  it('always returns an actual pool member', () => {
    for (let i = 0; i < 20; i++) {
      const country = dailyCountry(POOL, `2026-01-${String(i + 1).padStart(2, '0')}`);
      expect(POOL).toContain(country);
    }
  });
});
