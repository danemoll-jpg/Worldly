import { useEffect, useMemo, useState } from 'react';
import { COUNTRIES, MasteryLevel, masteryLevel, StatsMap, US_STATES, WATER_BODIES } from '@worldly/engine';
import { getUsStateMarkers, getWaterBodyMarkers, MapFeature, PointMarker } from '../lib/geo';
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
 * all three quiz universes now (a tab picker at top switches between them): countries render as
 * the real filled-in map shapes they always have; seas/oceans and US states — which have no
 * boundary geometry at all, see PointMarker's doc comment in geo.ts — render as the same colored
 * marker dots their own quiz screens use, just colored by mastery instead of session feedback. */
export function MasteryScreen({ stats, waterBodyStats, usStateStats, onBack }: MasteryScreenProps) {
  const [universe, setUniverse] = useState<Universe>('countries');
  const [waterBodyMarkers, setWaterBodyMarkers] = useState<PointMarker[]>([]);
  const [usStateMarkers, setUsStateMarkers] = useState<PointMarker[]>([]);

  useEffect(() => {
    let cancelled = false;
    getWaterBodyMarkers().then((loaded) => {
      if (!cancelled) setWaterBodyMarkers(loaded);
    });
    getUsStateMarkers().then((loaded) => {
      if (!cancelled) setUsStateMarkers(loaded);
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

  function waterBodyMarkerFillFor(marker: PointMarker): string {
    return LEVEL_COLOR[masteryLevel(waterBodyStats[marker.id])];
  }

  function usStateMarkerFillFor(marker: PointMarker): string {
    return LEVEL_COLOR[masteryLevel(usStateStats[marker.id])];
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
        <WorldMap fillFor={() => 'var(--map-land)'} markers={waterBodyMarkers} markerFillFor={waterBodyMarkerFillFor} showCountryMarkers={false} />
      )}
      {universe === 'usStates' && (
        <WorldMap fillFor={() => 'var(--map-land)'} markers={usStateMarkers} markerFillFor={usStateMarkerFillFor} showCountryMarkers={false} />
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
