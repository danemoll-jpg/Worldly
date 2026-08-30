import { useMemo, useState } from 'react';
import { COUNTRIES, COUNTRY_BY_ID } from '@worldly/engine';
import { playCountryAudio } from '../lib/countryAudio';
import { countryFlagSrc } from '../lib/format';
import { MapFeature } from '../lib/geo';
import { WorldMap } from './WorldMap';

interface LookupScreenProps {
  onBack: () => void;
}

/** Zero-pressure reference mode — search or tap around the map, see a name, flag, capital(s),
 * and languages. No quiz, no scoring, just a place to look something up or poke around before
 * quizzing yourself for real. Deliberately no population figure — see countries.ts's header
 * comment for why that field doesn't exist in the data at all. */
export function LookupScreen({ onBack }: LookupScreenProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)) : COUNTRIES;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [query]);

  const selected = selectedId ? COUNTRY_BY_ID[selectedId] : null;

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    if (feature.id === selectedId) return 'var(--map-target)';
    return 'var(--map-land)';
  }

  function handleMapTap(feature: MapFeature) {
    if (feature.quizzable) setSelectedId(feature.id);
  }

  return (
    <div className="app">
      <div className="quiz-header">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <span className="quiz-header__progress">{COUNTRIES.length} countries</span>
      </div>

      <input
        type="text"
        className="lookup-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search countries…"
      />

      <WorldMap fillFor={fillFor} onCountryTap={handleMapTap} />

      {selected && (
        <div className="lookup-detail">
          <div className="lookup-detail__headline">
            <img className="lookup-detail__flag" src={countryFlagSrc(selected)} alt="" />
            <div>
              <strong>{selected.name}</strong> — {selected.continent}
            </div>
          </div>
          <div className="lookup-detail__facts">
            <span>
              🏛 {selected.capitals.length > 1 ? 'Capitals' : 'Capital'}: {selected.capitals.join(', ')}
            </span>
            <span>🗣 {selected.languages.join(', ')}</span>
          </div>
          <div className="lookup-detail__listen">
            <button type="button" className="listen-btn" onClick={() => playCountryAudio(selected, 'en')}>
              🔊 English
            </button>
            <button type="button" className="listen-btn" onClick={() => playCountryAudio(selected, 'native')}>
              🔊 Native
            </button>
          </div>
        </div>
      )}

      <ul className="lookup-list">
        {filtered.map((c) => (
          <li key={c.id} className={c.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(c.id)}>
            {c.name}
            <span className="lookup-list__continent">{c.continent}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
