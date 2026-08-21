// A daily challenge is deliberately NOT personalized (unlike the rest of this engine, which is
// all about YOUR misses/weak spots) — same idea as Wordle: everyone gets the same one question
// on the same calendar day, out of the full country list, so it works as something to compare
// notes on rather than just another private drill.
import { CountryDef } from './types.js';

/** Simple deterministic string hash (djb2 variant) — good enough for picking an index
 * reproducibly, nothing security-sensitive here. Same input string always yields the same
 * output number, on any device, forever. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0; // force unsigned so % below is never negative
}

/** Today's date as a plain YYYY-MM-DD key, in the PLAYER's local calendar — deliberately not
 * UTC, so the challenge flips over at their own midnight, not while it's still yesterday
 * evening for them (or already tomorrow, depending on which side of UTC they're on). */
export function dailyDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministically picks the day's country from the full list — same `dateKey` always picks
 * the same country, on every device, with no server/sync needed for everyone to land on the
 * same question. Not filtered by continent or weak-spots scope; the whole point is one shared
 * question, not a personalized one. */
export function dailyCountry(countries: CountryDef[], dateKey: string = dailyDateKey()): CountryDef {
  const index = hashString(dateKey) % countries.length;
  return countries[index];
}
