import { useEffect, useRef, useState } from 'react';
import { GenericSessionSummary, SessionSummary } from '@worldly/engine';
import { LeaderboardQuizType, submitLeaderboardScore } from '../network/leaderboard';
import { getOrCreatePlayerId, getSavedDisplayName, saveDisplayName } from '../network/leaderboardIdentity';

export type LeaderboardSubmissionStatus = 'ineligible' | 'needsName' | 'submitting' | 'submitted' | 'notImproved' | 'error';

/** Drives the "🏆 submitted to the leaderboard!" flow shown on a quiz-complete screen — shared
 * across all three quiz types rather than tripled, since the flow itself (prompt for a display
 * name once, then submit silently on every future eligible completion) is identical regardless
 * of which quiz type it's for. Pass in the result of network/leaderboard.ts's
 * isCountryQuizLeaderboardEligible / isGenericQuizLeaderboardEligible as `eligible` rather than
 * duplicating that policy here. */
export function useLeaderboardSubmission(quizType: LeaderboardQuizType, eligible: boolean, summary: SessionSummary | GenericSessionSummary | null) {
  const [status, setStatus] = useState<LeaderboardSubmissionStatus>('ineligible');
  // Guards against submitting the same summary object twice (e.g. a re-render triggered by
  // something unrelated re-running this effect) — same "have we already reacted to this" ref
  // shape the quiz screens' own seenResultCount uses for their per-answer effects.
  const submittedFor = useRef<SessionSummary | GenericSessionSummary | null>(null);

  function submit(name: string, s: SessionSummary | GenericSessionSummary) {
    submittedFor.current = s;
    setStatus('submitting');
    const playerId = getOrCreatePlayerId();
    submitLeaderboardScore(quizType, playerId, name, s)
      .then((improved) => setStatus(improved ? 'submitted' : 'notImproved'))
      .catch(() => setStatus('error'));
  }

  useEffect(() => {
    if (!summary || !eligible) {
      setStatus('ineligible');
      return;
    }
    if (submittedFor.current === summary) return;
    const name = getSavedDisplayName();
    if (!name) {
      setStatus('needsName');
      return;
    }
    submit(name, summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizType, eligible, summary]);

  function submitName(name: string) {
    saveDisplayName(name);
    if (summary) submit(name, summary);
  }

  return { status, submitName };
}
