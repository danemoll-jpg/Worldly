import { useState } from 'react';
import {
  applySessionToStats,
  GenericAnswer,
  GenericQuizItem,
  GenericQuizMode,
  GenericQuizScope,
  GenericSessionState,
  GenericSessionSummary,
  isGenericSessionComplete,
  skipGenericCurrent,
  startGenericSession,
  StatsMap,
  submitGenericAnswer,
  summarizeGenericSession,
} from '@worldly/engine';
import { loadNamedStats, saveNamedStats } from '../lib/storage';

/** Shared session-management hook for the seas/oceans and US-states quizzes — the client-side
 * counterpart to genericSession.ts, same relationship useQuiz.ts has to session.ts, just scoped
 * down to what these two smaller quizzes actually need (no config surface beyond mode/scope, no
 * history/personal-bests/cross-device sync — see BACKLOG.md's writeup for why those stayed out
 * of v1). One instance of this hook is a self-contained "setup → play → summary" flow for a
 * single item set, identified by `storageKey` for its local miss-tracking StatsMap. */
export function useGenericQuiz<T extends GenericQuizItem>(items: T[], storageKey: string) {
  const [stats, setStats] = useState<StatsMap>(() => loadNamedStats(storageKey));
  const [session, setSession] = useState<GenericSessionState<T> | null>(null);
  const [summary, setSummary] = useState<GenericSessionSummary | null>(null);
  const [config, setConfig] = useState<{ mode: GenericQuizMode; scope: GenericQuizScope } | null>(null);

  function start(mode: GenericQuizMode, scope: GenericQuizScope) {
    setConfig({ mode, scope });
    setSession(startGenericSession(items, mode, scope, stats));
    setSummary(null);
  }

  function answer(ans: GenericAnswer) {
    setSession((prev) => {
      if (!prev) return prev;
      const next = submitGenericAnswer(prev, ans);
      if (isGenericSessionComplete(next)) {
        const nextStats = applySessionToStats(stats, next.results);
        setStats(nextStats);
        saveNamedStats(storageKey, nextStats);
        setSummary(summarizeGenericSession(next));
      }
      return next;
    });
  }

  function skip() {
    setSession((prev) => (prev ? skipGenericCurrent(prev) : prev));
  }

  function playAgain() {
    if (config) start(config.mode, config.scope);
  }

  function goHome() {
    setSession(null);
    setSummary(null);
    setConfig(null);
  }

  return { stats, session, summary, config, start, answer, skip, playAgain, goHome };
}
