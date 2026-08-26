import { describe, expect, it } from 'vitest';
import { US_STATE_BY_ID, US_STATES } from '../src/index.js';

describe('US_STATES data integrity', () => {
  it('has exactly 50 states', () => {
    expect(US_STATES).toHaveLength(50);
  });

  it('every id is a unique 2-letter USPS postal code', () => {
    const ids = US_STATES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('every entry has a non-empty name and capital', () => {
    for (const state of US_STATES) {
      expect(state.name.trim().length).toBeGreaterThan(0);
      expect(state.capital.trim().length).toBeGreaterThan(0);
    }
  });

  it('every marker coordinate is a plausible lon/lat pair within (or near) the US', () => {
    for (const state of US_STATES) {
      expect(state.lon).toBeGreaterThanOrEqual(-180);
      expect(state.lon).toBeLessThanOrEqual(-65);
      expect(state.lat).toBeGreaterThanOrEqual(15);
      expect(state.lat).toBeLessThanOrEqual(72);
    }
  });

  it('US_STATE_BY_ID matches US_STATES', () => {
    for (const state of US_STATES) {
      expect(US_STATE_BY_ID[state.id]).toBe(state);
    }
    expect(Object.keys(US_STATE_BY_ID)).toHaveLength(US_STATES.length);
  });

  it('does not include Washington DC or territories — scoped to the 50 states', () => {
    const names = US_STATES.map((s) => s.name);
    expect(names).not.toContain('District of Columbia');
    expect(names).not.toContain('Puerto Rico');
  });

  it('includes Alaska and Hawaii, correctly placed far from the continental US', () => {
    const alaska = US_STATE_BY_ID['AK'];
    const hawaii = US_STATE_BY_ID['HI'];
    expect(alaska.lat).toBeGreaterThan(50);
    expect(hawaii.lon).toBeLessThan(-150);
  });
});
