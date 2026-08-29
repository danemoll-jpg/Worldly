import { useState } from 'react';
import {
  GenericAnswer,
  GenericQuizItem,
  GenericQuizMode,
  GenericQuizScope,
  GenericSessionState,
  GenericSessionSummary,
  isGenericSessionComplete,
  overrideLastGenericResultAsCorrect,
  QuizAnswerResult,
  skipGenericCurrent,
  startGenericSession,
  StatsMap,
  submitGenericAnswer,
  summarizeGenericSession,
} from '@worldly/engine';
import { genericPersonalBestFor, GenericSessionRecord, newSessionRecordId, PersonalBest } from '../lib/storage';

/** Shared session-management hook for the seas/oceans and US-states quizzes — the client-side
 * counterpart to genericSession.ts, same relationship useQuiz.ts has to session.ts, just scoped
 * down to what these two smaller quizzes actually need (no config surface beyond mode/scope/
 * category, no continent filtering).
 *
 * Deliberately "controlled" rather than owning its own persisted state: `stats`/`history` come
 * in as plain values (from useQuiz.ts, which owns the one live sync subscription + localStorage
 * mirror for BOTH quiz universes — a second independent copy of that machinery per universe
 * would just mean a second Firestore listener on the same document), and `onComplete` is how a
 * finished session's record/results get back out to be persisted/synced. This hook itself only
 * ever holds the ephemeral, never-persisted parts: the in-progress session, its config, and the
 * summary/personal-best shown once it ends. */
export function useGenericQuiz<T extends GenericQuizItem>(
  items: T[],
  stats: StatsMap,
  history: GenericSessionRecord[],
  onComplete: (record: GenericSessionRecord, results: QuizAnswerResult[]) => void,
) {
  const [session, setSession] = useState<GenericSessionState<T> | null>(null);
  const [summary, setSummary] = useState<GenericSessionSummary | null>(null);
  const [config, setConfig] = useState<{ mode: GenericQuizMode; scope: GenericQuizScope; category: string } | null>(null);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);

  function start(mode: GenericQuizMode, scope: GenericQuizScope, category: string = 'name') {
    setConfig({ mode, scope, category });
    setSession(startGenericSession(items, mode, scope, stats));
    setSummary(null);
  }

  function answer(ans: GenericAnswer) {
    setSession((prev) => {
      if (!prev || !config) return prev;
      const next = submitGenericAnswer(prev, ans);
      if (isGenericSessionComplete(next)) {
        const finalSummary = summarizeGenericSession(next);
        const record: GenericSessionRecord = {
          id: newSessionRecordId(),
          completedAt: Date.now(),
          mode: config.mode,
          scope: config.scope,
          category: config.category,
          totalQuestions: finalSummary.totalQuestions,
          correctCount: finalSummary.correctCount,
          percentCorrect: finalSummary.percentCorrect,
          totalElapsedMs: finalSummary.totalElapsedMs,
        };
        // Compare against history BEFORE this session's own record joins it, same reasoning as
        // useQuiz.ts's answer — "new best" means beating a previous run, not tying yourself.
        setPersonalBest(genericPersonalBestFor(history, record.mode, record.scope, record.category));
        setSummary(finalSummary);
        onComplete(record, next.results);
      }
      return next;
    });
  }

  function skip() {
    setSession((prev) => (prev ? skipGenericCurrent(prev) : prev));
  }

  // "Actually, that was right" — see QuizScreen's own doc comment on the button that calls the
  // country-quiz equivalent of this. Only ever touches the answer just given.
  function overrideLastAnswer() {
    setSession((prev) => (prev ? overrideLastGenericResultAsCorrect(prev) : prev));
  }

  function playAgain() {
    if (config) start(config.mode, config.scope, config.category);
  }

  function goHome() {
    setSession(null);
    setSummary(null);
    setConfig(null);
  }

  return { session, summary, config, personalBest, start, answer, skip, overrideLastAnswer, playAgain, goHome };
}

export type GenericQuizController<T extends GenericQuizItem> = ReturnType<typeof useGenericQuiz<T>>;
