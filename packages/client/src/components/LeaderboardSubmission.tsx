import { GenericSessionSummary, SessionSummary } from '@worldly/engine';
import { useLeaderboardSubmission } from '../hooks/useLeaderboardSubmission';
import { LeaderboardQuizType } from '../network/leaderboard';
import { DisplayNamePrompt } from './DisplayNamePrompt';

interface LeaderboardSubmissionProps {
  quizType: LeaderboardQuizType;
  eligible: boolean;
  summary: SessionSummary | GenericSessionSummary | null;
  onViewLeaderboard: () => void;
}

/** Drops into a quiz-complete screen right after the personal-bests summary — see
 * useLeaderboardSubmission for the actual state machine this just renders. Renders nothing at
 * all for a non-eligible session (weak-spots runs, non-default categories, etc. — see
 * network/leaderboard.ts's eligibility helpers), same "quietly not there" treatment the rest of
 * this app gives to things that don't apply to the current session. */
export function LeaderboardSubmission({ quizType, eligible, summary, onViewLeaderboard }: LeaderboardSubmissionProps) {
  const { status, submitName } = useLeaderboardSubmission(quizType, eligible, summary);

  if (status === 'ineligible') return null;

  return (
    <div className="leaderboard-submission">
      {status === 'needsName' && <DisplayNamePrompt onSubmit={submitName} />}
      {status === 'submitting' && <p className="leaderboard-submission__status">Submitting to the leaderboard…</p>}
      {status === 'submitted' && (
        <p className="leaderboard-submission__status leaderboard-submission__status--success">
          🏆 New leaderboard entry!{' '}
          <button type="button" className="leaderboard-submission__link" onClick={onViewLeaderboard}>
            View leaderboard
          </button>
        </p>
      )}
      {status === 'notImproved' && (
        <p className="leaderboard-submission__status">
          <button type="button" className="leaderboard-submission__link" onClick={onViewLeaderboard}>
            🏆 View leaderboard
          </button>
        </p>
      )}
      {status === 'error' && (
        <p className="leaderboard-submission__status leaderboard-submission__status--muted">
          Couldn't reach the leaderboard (offline?) — your score is still saved locally.
        </p>
      )}
    </div>
  );
}
