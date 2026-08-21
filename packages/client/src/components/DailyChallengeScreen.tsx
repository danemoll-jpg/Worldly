import { useState } from 'react';
import { COUNTRIES } from '@worldly/engine';
import { GAME_HUB_URL } from '../lib/hub';
import { MapFeature } from '../lib/geo';
import { useDailyChallenge } from '../hooks/useDailyChallenge';
import { WorldMap } from './WorldMap';

interface DailyChallengeScreenProps {
  onBack: () => void;
}

/** One shared, deterministic question a day (see the engine's dailyCountry) — always "find this
 * flag on the map," always exactly one guess, no skip/restart/hint. Not personalized and not
 * folded into the regular history/records/stats pipeline at all — this is its own small,
 * separate streak-tracking feature (see useDailyChallenge), the same way a real daily-puzzle
 * app keeps that counter apart from anything else it tracks about you. */
export function DailyChallengeScreen({ onBack }: DailyChallengeScreenProps) {
  const daily = useDailyChallenge(COUNTRIES);
  const [justAnswered, setJustAnswered] = useState<{ correct: boolean } | null>(null);

  const done = daily.hasPlayedToday || justAnswered !== null;
  const resultCorrect = justAnswered ? justAnswered.correct : daily.lastPlayedCorrect;

  function handleTap(feature: MapFeature) {
    if (!feature.quizzable || done) return;
    const correct = feature.id === daily.todaysCountry.id;
    setJustAnswered({ correct });
    daily.complete(correct);
  }

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    if (done && feature.id === daily.todaysCountry.id) {
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
          🔥 {daily.streak}
        </span>
      </div>

      {!done && (
        <div className="quiz-prompt">
          <span>
            Today's flag — find the country: <span className="quiz-prompt__flag">{daily.todaysCountry.flagEmoji}</span>
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
              Today's flag was <span className="quiz-prompt__flag">{daily.todaysCountry.flagEmoji}</span> —{' '}
              <strong>{daily.todaysCountry.name}</strong>.
            </p>
            <p>
              {daily.streak > 0
                ? `🔥 ${daily.streak}-day streak — come back tomorrow to keep it going.`
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
