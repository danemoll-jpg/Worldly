import { useMemo, useState } from 'react';
import { CONTINENTS, Continent, COUNTRIES, QuizConfig, QuizMode, QuizScope, StatsMap } from '@worldly/engine';

interface SetupScreenProps {
  stats: StatsMap;
  onBack: () => void;
  onStart: (config: QuizConfig) => void;
}

function poolSize(continents: Continent[] | 'all', scope: QuizScope, stats: StatsMap): number {
  let pool = continents === 'all' ? COUNTRIES : COUNTRIES.filter((c) => continents.includes(c.continent));
  if (scope === 'weakSpots') pool = pool.filter((c) => (stats[c.id]?.missed ?? 0) > 0);
  return pool.length;
}

export function SetupScreen({ stats, onBack, onStart }: SetupScreenProps) {
  const [mode, setMode] = useState<QuizMode>('findIt');
  const [continents, setContinents] = useState<Continent[] | 'all'>('all');
  const [scope, setScope] = useState<QuizScope>('all');

  const weakSpotCount = useMemo(() => COUNTRIES.filter((c) => (stats[c.id]?.missed ?? 0) > 0).length, [stats]);
  const count = poolSize(continents, scope, stats);

  function toggleContinent(c: Continent) {
    setContinents((prev) => {
      const current = prev === 'all' ? [] : prev;
      const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
      return next.length === 0 ? 'all' : next;
    });
  }

  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <h1>Set up your quiz</h1>

        <label className="start-screen__label">
          How do you want to be quizzed?
          <div className="start-screen__options">
            <button type="button" className={mode === 'findIt' ? 'active' : ''} onClick={() => setMode('findIt')}>
              Find it on the map
            </button>
            <button type="button" className={mode === 'typeIt' ? 'active' : ''} onClick={() => setMode('typeIt')}>
              Type its name
            </button>
          </div>
          <span className="start-screen__hint">
            {mode === 'findIt'
              ? "You'll be told a country's name and tap it on the map."
              : "A country will be highlighted on the map and you'll type its name — untimed, and typos are forgiven."}
          </span>
        </label>

        <label className="start-screen__label">
          Which regions?
          <div className="setup-screen__continents">
            <button type="button" className={continents === 'all' ? 'active' : ''} onClick={() => setContinents('all')}>
              All regions
            </button>
            {CONTINENTS.map((c) => (
              <button
                key={c}
                type="button"
                className={continents !== 'all' && continents.includes(c) ? 'active' : ''}
                onClick={() => toggleContinent(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </label>

        <label className="start-screen__label">
          Which countries?
          <div className="start-screen__options">
            <button type="button" className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
              Everything
            </button>
            <button
              type="button"
              className={scope === 'weakSpots' ? 'active' : ''}
              disabled={weakSpotCount === 0}
              onClick={() => setScope('weakSpots')}
            >
              Just my weak spots
            </button>
          </div>
          <span className="start-screen__hint">
            {weakSpotCount === 0
              ? "You haven't missed anything yet — take a full quiz first and this unlocks."
              : `${weakSpotCount} countries you've missed at least once, across all regions.`}
          </span>
        </label>

        <p className="setup-screen__count">
          This quiz will cover <strong>{count}</strong> {count === 1 ? 'country' : 'countries'}.
        </p>

        <button type="button" className="start-screen__submit" disabled={count === 0} onClick={() => onStart({ mode, continents, scope })}>
          Start quiz
        </button>
      </div>
    </div>
  );
}
