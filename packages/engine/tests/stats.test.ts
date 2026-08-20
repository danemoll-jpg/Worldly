import { describe, expect, it } from 'vitest';
import { applyResultToStats, applySessionToStats, masteryLevel } from '../src/stats.js';
import { QuizAnswerResult, StatsMap } from '../src/types.js';

describe('applyResultToStats', () => {
  it('creates a fresh record for a never-seen country', () => {
    const next = applyResultToStats({}, { countryId: 'fr', correct: true, elapsedMs: 100 }, 5000);
    expect(next.fr).toEqual({ countryId: 'fr', seen: 1, missed: 0, lastSeenAt: 5000 });
  });

  it('increments seen and missed correctly across results', () => {
    let stats: StatsMap = {};
    stats = applyResultToStats(stats, { countryId: 'fr', correct: false, elapsedMs: 100 }, 1);
    stats = applyResultToStats(stats, { countryId: 'fr', correct: true, elapsedMs: 100 }, 2);
    expect(stats.fr).toEqual({ countryId: 'fr', seen: 2, missed: 1, lastSeenAt: 2 });
  });

  it('does not disturb other countries', () => {
    const stats: StatsMap = { de: { countryId: 'de', seen: 1, missed: 0, lastSeenAt: 1 } };
    const next = applyResultToStats(stats, { countryId: 'fr', correct: true, elapsedMs: 1 }, 2);
    expect(next.de).toEqual(stats.de);
  });
});

describe('applySessionToStats', () => {
  it('folds a whole results log into the stats map', () => {
    const results: QuizAnswerResult[] = [
      { countryId: 'fr', correct: true, elapsedMs: 10 },
      { countryId: 'de', correct: false, elapsedMs: 20 },
      { countryId: 'fr', correct: false, elapsedMs: 30 },
    ];
    const stats = applySessionToStats({}, results, 100);
    expect(stats.fr).toEqual({ countryId: 'fr', seen: 2, missed: 1, lastSeenAt: 100 });
    expect(stats.de).toEqual({ countryId: 'de', seen: 1, missed: 1, lastSeenAt: 100 });
  });
});

describe('masteryLevel', () => {
  it('is "new" when never seen', () => {
    expect(masteryLevel(undefined)).toBe('new');
    expect(masteryLevel({ countryId: 'x', seen: 0, missed: 0, lastSeenAt: null })).toBe('new');
  });

  it('is "solid" for a low miss ratio', () => {
    expect(masteryLevel({ countryId: 'x', seen: 10, missed: 0, lastSeenAt: null })).toBe('solid');
    expect(masteryLevel({ countryId: 'x', seen: 10, missed: 1, lastSeenAt: null })).toBe('solid');
  });

  it('is "shaky" for a moderate miss ratio', () => {
    expect(masteryLevel({ countryId: 'x', seen: 10, missed: 3, lastSeenAt: null })).toBe('shaky');
  });

  it('is "struggling" when missed more often than not', () => {
    expect(masteryLevel({ countryId: 'x', seen: 10, missed: 6, lastSeenAt: null })).toBe('struggling');
  });
});
