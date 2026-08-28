import { useEffect, useMemo, useState } from 'react';
import {
  COUNTRIES,
  COUNTRY_BY_ID,
  CountryStats,
  MasteryLevel,
  masteryLevel,
  StatsMap,
  US_STATE_BY_ID,
  US_STATES,
  WATER_BODIES,
  WATER_BODY_BY_ID,
} from '@worldly/engine';
import { countryFlagSrc } from '../lib/format';
import { getUsStateRegions, getWaterBodyRegions, MapFeature, MapRegion } from '../lib/geo';
import { WorldMap } from './WorldMap';

function flagSrc(usStateId: string): string {
  return `${import.meta.env.BASE_URL}data/flags/us-states/${usStateId.toLowerCase()}.svg`;
}

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
  // Which item (within the CURRENT universe) is showing its detail card, if any — cleared on
  // every tab switch so a Vatican City selection doesn't linger and look like a US state pick.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function switchUniverse(u: Universe) {
    setUniverse(u);
    setSelectedId(null);
  }

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

  function handleCountryTap(feature: MapFeature) {
    if (feature.quizzable) setSelectedId(feature.id);
  }

  // User request: "on the mastery screen, can we click on the area to see the country (or the
  // lake, sea or state)?" — a lightweight detail card (name + mastery level + how many times
  // it's actually been asked), same idea as the browse/atlas screen's own tap-to-see-detail, just
  // scoped to whichever universe's tab is active instead of always countries.
  const statsForUniverse = universe === 'countries' ? stats : universe === 'waterBodies' ? waterBodyStats : usStateStats;
  const selectedStat: CountryStats | undefined = selectedId ? statsForUniverse[selectedId] : undefined;
  const selectedLevel = masteryLevel(selectedStat);
  const selectedName =
    !selectedId
      ? null
      : universe === 'countries'
        ? (COUNTRY_BY_ID[selectedId]?.name ?? null)
        : universe === 'waterBodies'
          ? (WATER_BODY_BY_ID[selectedId]?.name ?? null)
          : (US_STATE_BY_ID[selectedId]?.name ?? null);
  const selectedFlagSrc =
    !selectedId
      ? null
      : universe === 'countries' && COUNTRY_BY_ID[selectedId]
        ? countryFlagSrc(COUNTRY_BY_ID[selectedId])
        : universe === 'usStates' && US_STATE_BY_ID[selectedId]
          ? flagSrc(selectedId)
          : null;

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
          <button key={u} type="button" className={universe === u ? 'active' : ''} onClick={() => switchUniverse(u)}>
            {UNIVERSE_LABEL[u]}
          </button>
        ))}
      </div>

      {universe === 'countries' && <WorldMap fillFor={fillFor} onCountryTap={handleCountryTap} />}
      {universe === 'waterBodies' && (
        <WorldMap
          fillFor={() => 'var(--map-land-inert)'}
          countryLayerInert
          className="world-map-wrap--water-quiz"
          regions={waterBodyRegions}
          regionFillFor={waterBodyRegionFillFor}
          regionStrokeFor={regionStrokeFor}
          onRegionTap={(region) => setSelectedId(region.id)}
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
          onRegionTap={(region) => setSelectedId(region.id)}
          showCountryMarkers={false}
          focusCountryId="840"
        />
      )}

      {selectedId && selectedName && (
        <div className="lookup-detail">
          <div className="lookup-detail__headline">
            {selectedFlagSrc && <img className="lookup-detail__flag" src={selectedFlagSrc} alt="" />}
            <div>
              <strong>{selectedName}</strong> — {LEVEL_LABEL[selectedLevel]}
            </div>
          </div>
          {/* The headline's level label already says "Not yet quizzed" for a fresh item — no
              need for the facts line to repeat it; it only adds anything once there's an actual
              seen/missed count to report. */}
          {selectedStat && selectedStat.seen > 0 && (
            <div className="lookup-detail__facts">
              <span>
                Asked {selectedStat.seen} time{selectedStat.seen === 1 ? '' : 's'}
              </span>
              <span>
                ❌ Missed {selectedStat.missed} time{selectedStat.missed === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
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
