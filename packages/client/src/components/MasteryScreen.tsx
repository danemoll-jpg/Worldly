import { useMemo } from 'react';
import { COUNTRIES, MasteryLevel, masteryLevel, StatsMap } from '@worldly/engine';
import { MapFeature } from '../lib/geo';
import { WorldMap } from './WorldMap';

interface MasteryScreenProps {
  stats: StatsMap;
  onBack: () => void;
}

const LEVEL_COLOR: Record<MasteryLevel, string> = {
  new: 'var(--mastery-new)',
  struggling: 'var(--mastery-struggling)',
  shaky: 'var(--mastery-shaky)',
  solid: 'var(--mastery-solid)',
};

const LEVEL_LABEL: Record<MasteryLevel, string> = {
  new: 'Not yet quizzed',
  struggling: 'Struggling',
  shaky: 'Shaky',
  solid: 'Solid',
};

/** Colors every quizzable country by how it's actually gone for you — the payoff view for all
 * that miss-tracking, and a nice way to see progress at a glance instead of just as numbers. */
export function MasteryScreen({ stats, onBack }: MasteryScreenProps) {
  const counts = useMemo(() => {
    const tally: Record<MasteryLevel, number> = { new: 0, struggling: 0, shaky: 0, solid: 0 };
    for (const country of COUNTRIES) tally[masteryLevel(stats[country.id])]++;
    return tally;
  }, [stats]);

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    return LEVEL_COLOR[masteryLevel(stats[feature.id])];
  }

  return (
    <div className="app">
      <div className="quiz-header">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
      </div>

      <WorldMap fillFor={fillFor} />

      <div className="mastery-legend">
        {(Object.keys(LEVEL_LABEL) as MasteryLevel[]).map((level) => (
          <span key={level} className="mastery-legend__item">
            <i className="mastery-legend__swatch" style={{ background: LEVEL_COLOR[level] }} />
            {LEVEL_LABEL[level]} ({counts[level]})
          </span>
        ))}
      </div>
    </div>
  );
}
