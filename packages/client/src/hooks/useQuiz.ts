import { useCallback, useState } from 'react';
import {
  Answer,
  applySessionToStats,
  COUNTRIES,
  isSessionComplete,
  QuizConfig,
  QuizSessionState,
  SessionSummary,
  StatsMap,
  startSession,
  submitAnswer,
  summarizeSession,
} from '@worldly/engine';
import { appendHistory, loadHistory, loadStats, PersonalBest, personalBestFor, saveStats, SessionRecord } from '../lib/storage';

export function continentsKey(continents: QuizConfig['continents']): string {
  return continents === 'all' ? 'all' : [...continents].sort().join(',');
}

/** Runs one quiz session end to end: engine session state, localStorage-backed per-country
 * stats (fed back into the NEXT session's miss-weighting), and session history for the
 * personal-best comparison shown on the summary screen. Entirely local — no server, no bots,
 * nothing to sync — this is a solo study tool. */
export function useQuiz() {
  const [stats, setStats] = useState<StatsMap>(() => loadStats());
  const [session, setSession] = useState<QuizSessionState | null>(null);
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);

  const start = useCallback(
    (nextConfig: QuizConfig) => {
      setConfig(nextConfig);
      setSummary(null);
      setSession(startSession(nextConfig, COUNTRIES, stats));
    },
    [stats],
  );

  const answer = useCallback(
    (a: Answer) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = submitAnswer(prev, a);

        if (isSessionComplete(next)) {
          const finalSummary = summarizeSession(next);
          const nextStats = applySessionToStats(stats, next.results);
          setStats(nextStats);
          saveStats(nextStats);

          const record: SessionRecord = {
            completedAt: Date.now(),
            mode: next.config.mode,
            scope: next.config.scope,
            continentsKey: continentsKey(next.config.continents),
            totalQuestions: finalSummary.totalQuestions,
            correctCount: finalSummary.correctCount,
            percentCorrect: finalSummary.percentCorrect,
            totalElapsedMs: finalSummary.totalElapsedMs,
          };
          // Compare against history BEFORE this session's own record joins it, so "new best"
          // means beating a previous run, not tying yourself.
          const priorBest = personalBestFor(loadHistory(), record.mode, record.scope, record.continentsKey);
          appendHistory(record);
          setPersonalBest(priorBest);
          setSummary(finalSummary);
        }

        return next;
      });
    },
    [stats],
  );

  const playAgain = useCallback(() => {
    if (config) start(config);
  }, [config, start]);

  const goHome = useCallback(() => {
    setSession(null);
    setSummary(null);
    setConfig(null);
  }, []);

  return { stats, session, config, summary, personalBest, start, answer, playAgain, goHome };
}
