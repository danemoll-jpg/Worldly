import { useMemo } from 'react';
import { COUNTRY_BY_ID, QuizAnswerResult } from '@worldly/engine';
import { countryFlagSrc } from '../lib/format';
import { MapFeature } from '../lib/geo';
import { WorldMap } from './WorldMap';

interface ReviewMapScreenProps {
  results: QuizAnswerResult[];
  onBack: () => void;
}

/** A static, post-quiz look at the whole map colored by how THIS session went — every country
 * actually asked about lit up green (correct) or red (missed), everything else its plain
 * default fill. Distinct from the live quiz's own persistent tint (--map-answered/--map-missed,
 * muted so it doesn't compete with the just-answered flash): there's no flash happening here, so
 * the fuller-strength --map-correct/--map-wrong reads clearly without needing to be dimmed down
 * for anything. Also stamps every reviewed country's flag regardless of what category was
 * actually played — spoiling isn't a concern once the quiz is already over, so this is a free
 * extra look at shape-to-flag pairing on top of whatever the session itself covered. Free
 * pan/zoom, no tap handler at all — this is a look-back, not another question. */
export function ReviewMapScreen({ results, onBack }: ReviewMapScreenProps) {
  const resultByCountry = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of results) m.set(r.countryId, r.correct);
    return m;
  }, [results]);

  const correctCount = results.filter((r) => r.correct).length;

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    const result = resultByCountry.get(feature.id);
    if (result === true) return 'var(--map-correct)';
    if (result === false) return 'var(--map-wrong)';
    return 'var(--map-land)';
  }

  function flagFor(feature: MapFeature): string | null {
    if (!resultByCountry.has(feature.id)) return null;
    const country = COUNTRY_BY_ID[feature.id];
    return country ? countryFlagSrc(country) : null;
  }

  return (
    <div className="app">
      <div className="quiz-header">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <span className="quiz-header__progress">
          {correctCount} / {results.length} correct
        </span>
      </div>
      <div className="quiz-prompt">
        <span>🟢 Correct · 🔴 Missed — pan and zoom to look around.</span>
      </div>
      <WorldMap fillFor={fillFor} flagFor={flagFor} />
    </div>
  );
}
