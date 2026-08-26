import { describe, expect, it } from 'vitest';
import { WATER_BODIES, WATER_BODY_BY_ID } from '../src/index.js';

describe('WATER_BODIES data integrity', () => {
  it('has exactly the 5 oceans plus a curated set of major seas', () => {
    const oceans = WATER_BODIES.filter((w) => w.kind === 'ocean');
    expect(oceans).toHaveLength(5);
    expect(WATER_BODIES.length).toBeGreaterThan(15);
  });

  it('every id is unique', () => {
    const ids = WATER_BODIES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty name and a valid kind', () => {
    for (const body of WATER_BODIES) {
      expect(body.name.trim().length).toBeGreaterThan(0);
      expect(['ocean', 'sea']).toContain(body.kind);
    }
  });

  it('every marker coordinate is a plausible lon/lat pair', () => {
    for (const body of WATER_BODIES) {
      expect(body.lon).toBeGreaterThanOrEqual(-180);
      expect(body.lon).toBeLessThanOrEqual(180);
      expect(body.lat).toBeGreaterThanOrEqual(-90);
      expect(body.lat).toBeLessThanOrEqual(90);
    }
  });

  it('WATER_BODY_BY_ID matches WATER_BODIES', () => {
    for (const body of WATER_BODIES) {
      expect(WATER_BODY_BY_ID[body.id]).toBe(body);
    }
    expect(Object.keys(WATER_BODY_BY_ID)).toHaveLength(WATER_BODIES.length);
  });

  it('includes the 5 oceans by name', () => {
    const names = WATER_BODIES.map((w) => w.name);
    expect(names).toContain('Pacific Ocean');
    expect(names).toContain('Atlantic Ocean');
    expect(names).toContain('Indian Ocean');
    expect(names).toContain('Southern Ocean');
    expect(names).toContain('Arctic Ocean');
  });
});
