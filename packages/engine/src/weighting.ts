// Decides what order a session asks its countries in — every country in the session's pool
// still gets asked exactly once (see session.ts), but countries with a rougher track record
// are more likely to come up sooner rather than later. Same "weighted random pick" idea the
// bots elsewhere in this series use to choose a move, just applied to picking a study order
// instead.
import { CountryDef, StatsMap } from './types.js';

/** 0-1: how often this country's been missed when seen before. Countries never seen at all get
 * a moderate default (0.5) rather than 0 — a fresh country deserves to show up at a normal
 * rate, not get pushed to the back of the line just because there's no history yet. */
export function missRatio(stats: StatsMap[string] | undefined): number {
  if (!stats || stats.seen === 0) return 0.5;
  return stats.missed / stats.seen;
}

/** Weighted random permutation without replacement: repeatedly pick one remaining country
 * (chance proportional to its weight), remove it, repeat. Weight is 1 (baseline, every country
 * has some chance) plus up to +4 more for a country missed every time it's been seen — enough
 * to meaningfully bias the order without making a single rough country dominate every session. */
export function buildWeightedOrder(pool: CountryDef[], statsMap: StatsMap, rng: () => number = Math.random): CountryDef[] {
  const remaining = pool.map((country) => ({ country, weight: 1 + missRatio(statsMap[country.id]) * 4 }));
  const order: CountryDef[] = [];

  while (remaining.length > 0) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng() * total;
    let pickIndex = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        pickIndex = i;
        break;
      }
    }
    order.push(remaining[pickIndex].country);
    remaining.splice(pickIndex, 1);
  }

  return order;
}
