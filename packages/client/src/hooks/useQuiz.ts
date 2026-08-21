import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Answer,
  applySessionToStats,
  COUNTRIES,
  isSessionComplete,
  QuizConfig,
  QuizSessionState,
  SessionSummary,
  skipCurrent,
  StatsMap,
  startSession,
  submitAnswer,
  summarizeSession,
} from '@worldly/engine';
import {
  appendHistory,
  loadHistory,
  loadStats,
  newSessionRecordId,
  PersonalBest,
  personalBestFor,
  saveHistory,
  saveStats,
  SessionRecord,
} from '../lib/storage';
import { applySessionToSync, connectToSyncCode, createSyncCode, subscribeSyncDoc, SyncDoc } from '../network/sync';
import { clearSyncCode, getSavedSyncCode, saveSyncCode } from '../network/syncSession';

export function continentsKey(continents: QuizConfig['continents']): string {
  return continents === 'all' ? 'all' : [...continents].sort().join(',');
}

export type SyncStatus = 'idle' | 'connecting' | 'synced' | 'error';

/** Runs one quiz session end to end: engine session state, per-country stats (fed back into
 * the NEXT session's miss-weighting), and session history for the personal-best comparison
 * shown on the summary screen. Local-only (localStorage) by default; once cross-device sync is
 * turned on (see network/sync.ts), stats/history come from — and every completed session
 * writes to — a shared Firestore document instead, mirrored to localStorage as a fast-loading
 * cache. No bots, no opponents — this is a solo study tool, sync is the only "networked" thing
 * about it. */
export function useQuiz() {
  const [stats, setStats] = useState<StatsMap>(() => loadStats());
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory());
  const [session, setSession] = useState<QuizSessionState | null>(null);
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);

  const [syncCode, setSyncCode] = useState<string | null>(() => getSavedSyncCode());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (getSavedSyncCode() ? 'connecting' : 'idle'));
  const [syncError, setSyncError] = useState<string | null>(null);

  // Always current inside callbacks without needing them as effect/callback dependencies —
  // avoids re-creating `answer` (and therefore anything memoized off it) on every stats tick.
  const stateRef = useRef({ stats, history, syncCode });
  stateRef.current = { stats, history, syncCode };

  // Subscribe whenever a sync code is active (on mount, if one was remembered from a previous
  // session, and immediately after createSync/connectSync set one).
  useEffect(() => {
    if (!syncCode) return undefined;
    const unsubscribe = subscribeSyncDoc(syncCode, (doc: SyncDoc | null) => {
      if (!doc) {
        setSyncStatus('error');
        setSyncError('That sync code no longer exists.');
        return;
      }
      setStats(doc.stats);
      setHistory(doc.history);
      saveStats(doc.stats);
      saveHistory(doc.history);
      setSyncStatus('synced');
    });
    return unsubscribe;
  }, [syncCode]);

  const createSync = useCallback(async () => {
    setSyncStatus('connecting');
    setSyncError(null);
    try {
      const { stats: currentStats, history: currentHistory } = stateRef.current;
      const code = await createSyncCode(currentStats, currentHistory);
      saveSyncCode(code);
      setSyncCode(code);
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Could not start syncing.');
    }
  }, []);

  const connectSync = useCallback(async (code: string) => {
    setSyncStatus('connecting');
    setSyncError(null);
    try {
      const { stats: currentStats, history: currentHistory } = stateRef.current;
      const merged = await connectToSyncCode(code, currentStats, currentHistory);
      setStats(merged.stats);
      setHistory(merged.history);
      saveStats(merged.stats);
      saveHistory(merged.history);
      saveSyncCode(code.toUpperCase());
      setSyncCode(code.toUpperCase());
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Could not connect to that code.');
    }
  }, []);

  const disconnectSync = useCallback(() => {
    clearSyncCode();
    setSyncCode(null);
    setSyncStatus('idle');
    setSyncError(null);
    // Local data (already mirrored throughout) just keeps being used going forward, purely
    // locally again — disconnecting never deletes anything, on this device or in the cloud.
  }, []);

  const start = useCallback(
    (nextConfig: QuizConfig) => {
      setConfig(nextConfig);
      setSummary(null);
      setSession(startSession(nextConfig, COUNTRIES, stats));
    },
    [stats],
  );

  const answer = useCallback((a: Answer) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = submitAnswer(prev, a);

      if (isSessionComplete(next)) {
        const finalSummary = summarizeSession(next);
        const { stats: currentStats, history: currentHistory, syncCode: currentSyncCode } = stateRef.current;

        const record: SessionRecord = {
          id: newSessionRecordId(),
          completedAt: Date.now(),
          mode: next.config.mode,
          // Continent mode doesn't have a category (see QuizConfig.category) — 'country' here
          // is just a harmless, consistent default, never shown or compared against anything.
          category: next.config.mode === 'continent' ? 'country' : next.config.category,
          scope: next.config.scope,
          continentsKey: continentsKey(next.config.continents),
          totalQuestions: finalSummary.totalQuestions,
          correctCount: finalSummary.correctCount,
          percentCorrect: finalSummary.percentCorrect,
          totalElapsedMs: finalSummary.totalElapsedMs,
        };
        // Compare against history BEFORE this session's own record joins it, so "new best"
        // means beating a previous run, not tying yourself.
        setPersonalBest(personalBestFor(currentHistory, record.mode, record.category, record.scope, record.continentsKey));
        setSummary(finalSummary);

        if (currentSyncCode) {
          // Applied via a transaction against whatever the latest shared copy actually is —
          // see sync.ts — so this is safe even if another device finished a session moments
          // ago. State updates when this resolves (not optimistically here), so this device
          // ends up showing the same reconciled numbers every other connected device does,
          // rather than a locally-computed guess that a moment later gets silently overwritten.
          applySessionToSync(currentSyncCode, record, next.results)
            .then((doc) => {
              setStats(doc.stats);
              setHistory(doc.history);
              saveStats(doc.stats);
              saveHistory(doc.history);
            })
            .catch(() => {
              // Sync is a nice-to-have — a failed write shouldn't disrupt the summary screen
              // the player's already looking at, and the next successful sync reconciles it.
            });
        } else {
          const nextStats = applySessionToStats(currentStats, next.results);
          setStats(nextStats);
          saveStats(nextStats);
          setHistory(appendHistory(record));
        }
      }

      return next;
    });
  }, []);

  const skip = useCallback(() => {
    setSession((prev) => (prev ? skipCurrent(prev) : prev));
  }, []);

  const playAgain = useCallback(() => {
    if (config) start(config);
  }, [config, start]);

  const goHome = useCallback(() => {
    setSession(null);
    setSummary(null);
    setConfig(null);
  }, []);

  return {
    stats,
    history,
    session,
    config,
    summary,
    personalBest,
    start,
    answer,
    skip,
    playAgain,
    goHome,
    syncCode,
    syncStatus,
    syncError,
    createSync,
    connectSync,
    disconnectSync,
  };
}
