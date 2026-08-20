import { COUNTRY_BY_ID, QuizConfig, SessionSummary } from '@worldly/engine';
import { formatDuration } from '../lib/format';
import { GAME_HUB_URL } from '../lib/hub';
import { PersonalBest } from '../lib/storage';

interface SummaryScreenProps {
  summary: SessionSummary;
  config: QuizConfig;
  personalBest: PersonalBest | null;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function SummaryScreen({ summary, personalBest, onPlayAgain, onHome }: SummaryScreenProps) {
  const newBestAccuracy = personalBest ? (personalBest.bestAccuracy === null || summary.percentCorrect > personalBest.bestAccuracy) : false;
  const newBestTime = personalBest ? (personalBest.bestTimeMs === null || summary.totalElapsedMs < personalBest.bestTimeMs) : false;
  const misses = summary.results.filter((r) => !r.correct);

  return (
    <div className="game-over">
      <div className="game-over__card">
        <div className="game-over__emoji">🌍</div>
        <h2>Quiz complete!</h2>

        <div className="summary-stats">
          <div className="summary-stat">
            <span className="summary-stat__value">{summary.percentCorrect}%</span>
            <span className="summary-stat__label">Correct{newBestAccuracy && <span className="new-record-badge">🏅 New best!</span>}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat__value">{formatDuration(summary.totalElapsedMs)}</span>
            <span className="summary-stat__label">Time{newBestTime && <span className="new-record-badge">🏅 New best!</span>}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat__value">
              {summary.correctCount}/{summary.totalQuestions}
            </span>
            <span className="summary-stat__label">Score</span>
          </div>
        </div>

        {misses.length > 0 && (
          <div className="summary-misses">
            <h3>Missed this round</h3>
            <ul>
              {misses.map((m) => (
                <li key={m.countryId}>{COUNTRY_BY_ID[m.countryId]?.name ?? m.countryId}</li>
              ))}
            </ul>
            <p className="summary-misses__hint">These are now in your "weak spots" pool for next time.</p>
          </div>
        )}

        <div className="game-over__actions">
          <button type="button" className="game-over__button" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="game-over__button game-over__button--secondary" onClick={onHome}>
            🏠 Home
          </button>
          <a className="game-over__button game-over__button--secondary" href={GAME_HUB_URL}>
            🎮 Game Hub
          </a>
        </div>
      </div>
    </div>
  );
}
