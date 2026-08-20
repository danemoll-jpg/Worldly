import { describe, expect, it } from 'vitest';
import { isAnswerCorrect } from '../src/matching.js';
import { CountryDef } from '../src/types.js';

const FRANCE: CountryDef = { id: '250', name: 'France', continent: 'Europe' };
const USA: CountryDef = { id: '840', name: 'United States of America', continent: 'North America', aliases: ['United States', 'USA', 'US', 'America'] };
const CONGO_DRC: CountryDef = {
  id: '180',
  name: 'Democratic Republic of the Congo',
  continent: 'Africa',
  aliases: ['DR Congo', 'DRC', 'Congo-Kinshasa', 'Zaire'],
};
const IVORY_COAST: CountryDef = { id: '384', name: "Côte d'Ivoire", continent: 'Africa', aliases: ['Ivory Coast'] };
const CHAD: CountryDef = { id: '148', name: 'Chad', continent: 'Africa' };

describe('isAnswerCorrect', () => {
  it('accepts an exact match', () => {
    expect(isAnswerCorrect('France', FRANCE)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAnswerCorrect('france', FRANCE)).toBe(true);
    expect(isAnswerCorrect('FRANCE', FRANCE)).toBe(true);
  });

  it('accepts an alias', () => {
    expect(isAnswerCorrect('USA', USA)).toBe(true);
    expect(isAnswerCorrect('DRC', CONGO_DRC)).toBe(true);
  });

  it('ignores accents and punctuation', () => {
    expect(isAnswerCorrect('Cote d Ivoire', IVORY_COAST)).toBe(true);
    expect(isAnswerCorrect('cotedivoire', IVORY_COAST)).toBe(true);
    expect(isAnswerCorrect('Ivory Coast', IVORY_COAST)).toBe(true);
  });

  it('forgives a small typo on a longer name', () => {
    expect(isAnswerCorrect('Democratic Republik of the Congo', CONGO_DRC)).toBe(true);
    expect(isAnswerCorrect('Franse', FRANCE)).toBe(true); // one-letter slip, well within tolerance
  });

  it('does not forgive typos on very short names, to avoid matching a different country', () => {
    // "Chad" is short enough that a single-letter change is basically a different word —
    // tolerance(4) === 0, so this must be an exact match only.
    expect(isAnswerCorrect('Chod', CHAD)).toBe(false);
    expect(isAnswerCorrect('Chad', CHAD)).toBe(true);
  });

  it('rejects an unrelated word', () => {
    expect(isAnswerCorrect('Germany', FRANCE)).toBe(false);
  });

  it('rejects empty or whitespace-only input', () => {
    expect(isAnswerCorrect('', FRANCE)).toBe(false);
    expect(isAnswerCorrect('   ', FRANCE)).toBe(false);
  });
});
