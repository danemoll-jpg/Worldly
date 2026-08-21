import { useMemo, useState } from 'react';
import { CONTINENTS, Continent, COUNTRIES, masteryLevel, QuizCategory, QuizConfig, QuizMode, QuizScope, StatsMap } from '@worldly/engine';

interface SetupScreenProps {
  stats: StatsMap;
  onBack: () => void;
  onStart: (config: QuizConfig) => void;
}

// Same 'shaky'/'struggling' definition session.ts's filterPool uses for the real weak-spots
// pool (miss RATIO, not a lifetime "ever missed once" flag) — this used to be its own separate
// `missed > 0` check that quietly drifted from what a weak-spots quiz actually contained, so the
// count shown here could disagree with both the quiz you were about to start and the mastery
// map. Keeping both filters point at the same masteryLevel call is what keeps them honest.
function isWeakSpot(countryId: string, stats: StatsMap): boolean {
  const level = masteryLevel(stats[countryId]);
  return level === 'shaky' || level === 'struggling';
}

function poolSize(continents: Continent[] | 'all', scope: QuizScope, stats: StatsMap): number {
  let pool = continents === 'all' ? COUNTRIES : COUNTRIES.filter((c) => continents.includes(c.continent));
  if (scope === 'weakSpots') pool = pool.filter((c) => isWeakSpot(c.id, stats));
  return pool.length;
}

export function SetupScreen({ stats, onBack, onStart }: SetupScreenProps) {
  const [mode, setMode] = useState<QuizMode>('findIt');
  const [category, setCategory] = useState<QuizCategory>('country');
  const [continents, setContinents] = useState<Continent[] | 'all'>('all');
  const [scope, setScope] = useState<QuizScope>('all');

  const weakSpotCount = useMemo(() => COUNTRIES.filter((c) => isWeakSpot(c.id, stats)).length, [stats]);
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
            <button type="button" className={mode === 'continent' ? 'active' : ''} onClick={() => setMode('continent')}>
              Guess the continent
            </button>
          </div>
          <span className="start-screen__hint">
            {mode === 'findIt'
              ? "You'll be told a country and tap it on the map."
              : mode === 'typeIt'
                ? "A country will be highlighted on the map and you'll type its name — untimed, and typos are forgiven."
                : "You'll see a country's name and pick which of the 6 continents it's in — the gentlest mode, good for a quick warm-up."}
          </span>
        </label>

        {mode !== 'continent' && (
          <label className="start-screen__label">
            Quiz me on…
            <div className="start-screen__options">
              <button type="button" className={category === 'country' ? 'active' : ''} onClick={() => setCategory('country')}>
                Country names
              </button>
              <button type="button" className={category === 'flag' ? 'active' : ''} onClick={() => setCategory('flag')}>
                🇺🇳 Flags
              </button>
              <button type="button" className={category === 'capital' ? 'active' : ''} onClick={() => setCategory('capital')}>
                Capitals
              </button>
            </div>
            <span className="start-screen__hint">
              {category === 'country'
                ? "The classic version — the country's own name is the prompt."
                : category === 'flag'
                  ? "You'll be shown a flag instead of a name — still guessing the same country either way."
                  : "You'll be shown a capital city instead of a name — still guessing the country it belongs to."}
            </span>
          </label>
        )}

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
              ? "Nothing currently shaky or struggling — take a full quiz first and this unlocks."
              : `${weakSpotCount} countries currently shaky or struggling, across all regions — same list as the mastery map, so this one shrinks as you improve.`}
          </span>
        </label>

        <p className="setup-screen__count">
          This quiz will cover <strong>{count}</strong> {count === 1 ? 'country' : 'countries'}.
        </p>

        <button
          type="button"
          className="start-screen__submit"
          disabled={count === 0}
          onClick={() => onStart({ mode, category, continents, scope })}
        >
          Start quiz
        </button>
      </div>
    </div>
  );
}
