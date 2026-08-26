import { useState } from 'react';
import { COUNTRIES, dailyCountry, dailyDateKey } from '@worldly/engine';
import { countryFlagSrc } from '../lib/format';
import { GAME_HUB_URL } from '../lib/hub';
import { MapFeature } from '../lib/geo';
import { DailyChallengeState } from '../lib/storage';
import { WorldMap } from './WorldMap';

interface DailyChallengeScreenProps {
  dailyChallenge: DailyChallengeState;
  onComplete: (correct: boolean) => void;
  onBack: () => void;
}

/** One shared, deterministic question a day (see the engine's dailyCountry) — always "find this
 * flag on the map," always exactly one guess, no skip/restart/hint. Not personalized and not
 * folded into the regular history/stats pipeline at all — this is its own small, separate
 * streak-tracking feature — but IS folded into the same cross-device sync pipeline those go
 * through (see useQuiz.ts's completeDailyChallenge), unlike when this screen owned its own
 * localStorage-only state via the now-removed useDailyChallenge hook. */
export function DailyChallengeScreen({ dailyChallenge, onComplete, onBack }: DailyChallengeScreenProps) {
  const todayKey = dailyDateKey();
  const todaysCountry = dailyCountry(COUNTRIES, todayKey);
  const hasPlayedToday = dailyChallenge.lastPlayedDateKey === todayKey;
  const [justAnswered, setJustAnswered] = useState<{ correct: boolean } | null>(null);

  const done = hasPlayedToday || justAnswered !== null;
  const resultCorrect = justAnswered ? justAnswered.correct : dailyChallenge.lastPlayedCorrect;

  function handleTap(feature: MapFeature) {
    if (!feature.quizzable || done) return;
    const correct = feature.id === todaysCountry.id;
    setJustAnswered({ correct });
    onComplete(correct);
  }

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    if (done && feature.id === todaysCountry.id) {
      return resultCorrect ? 'var(--map-correct)' : 'var(--map-wrong)';
    }
    return 'var(--map-land)';
  }

  return (
    <div className="app">
      <div className="quiz-header">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <span className="quiz-header__progress" title="Consecutive days answered correctly">
          🔥 {dailyChallenge.streak}
        </span>
      </div>

      {!done && (
        <div className="quiz-prompt">
          <span>
            Today's flag — find the country: <img className="quiz-prompt__flag" src={countryFlagSrc(todaysCountry)} alt="" />
          </span>
        </div>
      )}

      <WorldMap fillFor={fillFor} onCountryTap={handleTap} />

      {done && (
        <div className="game-over">
          <div className="game-over__card">
            <div className="game-over__emoji">{resultCorrect ? '🎉' : '📍'}</div>
            <h2>{resultCorrect ? 'Nailed it!' : "That's alright"}</h2>
            <p>
              Today's flag was <img className="quiz-prompt__flag" src={countryFlagSrc(todaysCountry)} alt="" /> —{' '}
              <strong>{todaysCountry.name}</strong>.
            </p>
            <p>
              {dailyChallenge.streak > 0
                ? `🔥 ${dailyChallenge.streak}-day streak — come back tomorrow to keep it going.`
                : 'Come back tomorrow for a new one — a correct answer starts a fresh streak.'}
            </p>
            <div className="game-over__actions">
              <button type="button" className="game-over__button game-over__button--secondary" onClick={onBack}>
                🏠 Home
              </button>
              <a className="game-over__button game-over__button--secondary" href={GAME_HUB_URL}>
                🎮 Game Hub
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
