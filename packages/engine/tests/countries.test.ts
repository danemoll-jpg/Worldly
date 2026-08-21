import { describe, expect, it } from 'vitest';
import { CONTINENTS, COUNTRIES, COUNTRY_BY_ID } from '../src/index.js';

describe('COUNTRIES data integrity', () => {
  it('has a sensible number of quizzable countries (roughly the UN member count plus a few notable exceptions)', () => {
    expect(COUNTRIES.length).toBeGreaterThan(190);
    expect(COUNTRIES.length).toBeLessThan(205);
  });

  it('every id is unique', () => {
    const ids = COUNTRIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty name and a valid continent', () => {
    for (const country of COUNTRIES) {
      expect(country.name.trim().length).toBeGreaterThan(0);
      expect(CONTINENTS).toContain(country.continent);
    }
  });

  it('COUNTRY_BY_ID matches COUNTRIES', () => {
    for (const country of COUNTRIES) {
      expect(COUNTRY_BY_ID[country.id]).toBe(country);
    }
    expect(Object.keys(COUNTRY_BY_ID)).toHaveLength(COUNTRIES.length);
  });

  it('every entry has a capital, at least one language, and a flag emoji', () => {
    for (const country of COUNTRIES) {
      expect(country.capitals.length).toBeGreaterThan(0);
      expect(country.capitals[0].trim().length).toBeGreaterThan(0);
      expect(country.languages.length).toBeGreaterThan(0);
      expect(country.flagEmoji.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes some well-known and some genuinely obscure countries — completeness is the whole point', () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toContain('France');
    expect(names).toContain('United States of America');
    // Tuvalu (the world's 4th-smallest country) is missing from the lower-resolution version
    // of this map dataset — being present here is a direct check that the 10m-resolution data
    // is what's actually bundled, not a smaller one that quietly drops the tiniest states.
    expect(names).toContain('Tuvalu');
    expect(names).toContain('Nauru');
    expect(names).toContain('Vatican City');
  });
});
