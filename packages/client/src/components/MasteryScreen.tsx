import { useEffect, useMemo, useState } from 'react';
import { COUNTRIES, MasteryLevel, masteryLevel, StatsMap, US_STATES, WATER_BODIES } from '@worldly/engine';
import { getUsStateRegions, getWaterBodyRegions, MapFeature, MapRegion } from '../lib/geo';
import { WorldMap } from './WorldMap';

interface MasteryScreenProps {
  stats: StatsMap;
  waterBodyStats: StatsMap;
  usStateStats: StatsMap;
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

type Universe = 'countries' | 'waterBodies' | 'usStates';

const UNIVERSE_LABEL: Record<Universe, string> = {
  countries: '🌍 Countries',
  waterBodies: '🌊 Seas & oceans',
  usStates: '🇺🇸 US states',
};

/** Colors every quizzable item by how it's actually gone for you — the payoff view for all that
 * miss-tracking, and a nice way to see progress at a glance instead of just as numbers. Covers
 * all three quiz universes now (a tab picker at top switches between them), all as real filled
 * shapes: countries render as the country map always has; seas/oceans and US states render as
 * their own real region shapes (see MapRegion's doc comment in geo.ts), just colored by mastery
 * instead of session feedback — same shapes their own quiz screens use, not the marker dots
 * those started with before real boundary data existed for either. */
export function MasteryScreen({ stats, waterBodyStats, usStateStats, onBack }: MasteryScreenProps) {
  const [universe, setUniverse] = useState<Universe>('countries');
  const [waterBodyRegions, setWaterBodyRegions] = useState<MapRegion[]>([]);
  const [usStateRegions, setUsStateRegions] = useState<MapRegion[]>([]);

  useEffect(() => {
    let cancelled = false;
    getWaterBodyRegions().then((loaded) => {
      if (!cancelled) setWaterBodyRegions(loaded);
    });
    getUsStateRegions().then((loaded) => {
      if (!cancelled) setUsStateRegions(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const tally: Record<MasteryLevel, number> = { new: 0, struggling: 0, shaky: 0, solid: 0 };
    if (universe === 'countries') {
      for (const country of COUNTRIES) tally[masteryLevel(stats[country.id])]++;
    } else if (universe === 'waterBodies') {
      for (const body of WATER_BODIES) tally[masteryLevel(waterBodyStats[body.id])]++;
    } else {
      for (const state of US_STATES) tally[masteryLevel(usStateStats[state.id])]++;
    }
    return tally;
  }, [universe, stats, waterBodyStats, usStateStats]);

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    return LEVEL_COLOR[masteryLevel(stats[feature.id])];
  }

  function waterBodyRegionFillFor(region: MapRegion): string {
    return LEVEL_COLOR[masteryLevel(waterBodyStats[region.id])];
  }

  function usStateRegionFillFor(region: MapRegion): string {
    return LEVEL_COLOR[masteryLevel(usStateStats[region.id])];
  }

  // Mastery map always shows borders — there's no "hide until answered" concept here, so this is
  // just a constant. (.world-map__region deliberately carries no CSS stroke color: a stylesheet
  // rule would silently outrank whatever a caller passes here, so every caller must be explicit.)
  function regionStrokeFor(): string {
    return 'rgba(224, 164, 88, 0.55)';
  }

  return (
    <div className="app">
      <div className="quiz-header">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
      </div>

      <div className="start-screen__options mastery-universe-picker">
        {(Object.keys(UNIVERSE_LABEL) as Universe[]).map((u) => (
          <button key={u} type="button" className={universe === u ? 'active' : ''} onClick={() => setUniverse(u)}>
            {UNIVERSE_LABEL[u]}
          </button>
        ))}
      </div>

      {universe === 'countries' && <WorldMap fillFor={fillFor} />}
      {universe === 'waterBodies' && (
        <WorldMap
          fillFor={() => 'var(--map-land-inert)'}
          countryLayerInert
          className="world-map-wrap--water-quiz"
          regions={waterBodyRegions}
          regionFillFor={waterBodyRegionFillFor}
          regionStrokeFor={regionStrokeFor}
          showCountryMarkers={false}
        />
      )}
      {universe === 'usStates' && (
        <WorldMap
          fillFor={() => 'var(--map-land)'}
          countryLayerInert
          regions={usStateRegions}
          regionFillFor={usStateRegionFillFor}
          regionStrokeFor={regionStrokeFor}
          showCountryMarkers={false}
          focusCountryId="840"
        />
      )}

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
