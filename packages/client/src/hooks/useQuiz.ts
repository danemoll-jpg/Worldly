import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Answer,
  applySessionToStats,
  COUNTRIES,
  dailyDateKey,
  isSessionComplete,
  overrideLastResultAsCorrect,
  QuizAnswerResult,
  QuizConfig,
  QuizSessionState,
  SessionSummary,
  skipCurrent,
  StatsMap,
  startSession,
  submitAnswer,
  summarizeSession,
  US_STATES,
  WATER_BODIES,
} from '@worldly/engine';
import {
  appendGenericHistory,
  appendHistory,
  DailyChallengeState,
  GenericSessionRecord,
  loadDailyChallengeState,
  loadGenericHistory,
  loadHistory,
  loadNamedStats,
  loadStats,
  newSessionRecordId,
  PersonalBest,
  personalBestFor,
  saveDailyChallengeState,
  saveGenericHistory,
  saveHistory,
  saveNamedStats,
  saveStats,
  SessionRecord,
} from '../lib/storage';
import {
  applyDailyChallengeToSync,
  applyGenericSessionToSync,
  applySessionToSync,
  connectToSyncCode,
  createSyncCode,
  GenericSyncFields,
  resetSyncDoc,
  subscribeSyncDoc,
  SyncDoc,
  SyncExtras,
} from '../network/sync';
import { clearSyncCode, getSavedSyncCode, saveSyncCode } from '../network/syncSession';
import { playSound } from '../lib/sound';
import { useGenericQuiz } from './useGenericQuiz';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const WATER_BODY_STATS_KEY = 'worldlyWaterBodyStats';
const WATER_BODY_HISTORY_KEY = 'worldlyWaterBodyHistory';
const US_STATE_STATS_KEY = 'worldlyUsStateStats';
const US_STATE_HISTORY_KEY = 'worldlyUsStateHistory';

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
 * about it.
 *
 * Also the single owner of the seas/oceans and US-states quizzes' stats/history (via two
 * `useGenericQuiz` instances below) and the daily-challenge streak — all three go through this
 * SAME sync subscription/localStorage-mirror machinery the country quiz does, rather than each
 * being its own hook with its own independent Firestore listener on the same document. */
export function useQuiz() {
  const [stats, setStats] = useState<StatsMap>(() => loadStats());
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory());
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeState>(() => loadDailyChallengeState());
  const [waterBodyStats, setWaterBodyStats] = useState<StatsMap>(() => loadNamedStats(WATER_BODY_STATS_KEY));
  const [waterBodyHistory, setWaterBodyHistory] = useState<GenericSessionRecord[]>(() => loadGenericHistory(WATER_BODY_HISTORY_KEY));
  const [usStateStats, setUsStateStats] = useState<StatsMap>(() => loadNamedStats(US_STATE_STATS_KEY));
  const [usStateHistory, setUsStateHistory] = useState<GenericSessionRecord[]>(() => loadGenericHistory(US_STATE_HISTORY_KEY));
  const [session, setSession] = useState<QuizSessionState | null>(null);
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);

  const [syncCode, setSyncCode] = useState<string | null>(() => getSavedSyncCode());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (getSavedSyncCode() ? 'connecting' : 'idle'));
  const [syncError, setSyncError] = useState<string | null>(null);

  // Always current inside callbacks without needing them as effect/callback dependencies —
  // avoids re-creating `answer` (and therefore anything memoized off it) on every stats tick.
  const stateRef = useRef({ stats, history, dailyChallenge, waterBodyStats, waterBodyHistory, usStateStats, usStateHistory, syncCode });
  stateRef.current = { stats, history, dailyChallenge, waterBodyStats, waterBodyHistory, usStateStats, usStateHistory, syncCode };

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
      // Every field below is absent (not just empty) on a doc written before it existed — leave
      // whatever's already showing locally alone rather than treating "field missing" the same
      // as "field present and empty," which would wipe real local progress the first time an old
      // doc is read after a new field shipped (see SyncDoc's own doc comment).
      if (doc.dailyChallenge) {
        setDailyChallenge(doc.dailyChallenge);
        saveDailyChallengeState(doc.dailyChallenge);
      }
      if (doc.waterBodyStats) {
        setWaterBodyStats(doc.waterBodyStats);
        saveNamedStats(WATER_BODY_STATS_KEY, doc.waterBodyStats);
      }
      if (doc.waterBodyHistory) {
        setWaterBodyHistory(doc.waterBodyHistory);
        saveGenericHistory(WATER_BODY_HISTORY_KEY, doc.waterBodyHistory);
      }
      if (doc.usStateStats) {
        setUsStateStats(doc.usStateStats);
        saveNamedStats(US_STATE_STATS_KEY, doc.usStateStats);
      }
      if (doc.usStateHistory) {
        setUsStateHistory(doc.usStateHistory);
        saveGenericHistory(US_STATE_HISTORY_KEY, doc.usStateHistory);
      }
      setSyncStatus('synced');
    });
    return unsubscribe;
  }, [syncCode]);

  function currentExtras(): SyncExtras {
    const { dailyChallenge: d, waterBodyStats: wbs, waterBodyHistory: wbh, usStateStats: uss, usStateHistory: ush } = stateRef.current;
    return { dailyChallenge: d, waterBodyStats: wbs, waterBodyHistory: wbh, usStateStats: uss, usStateHistory: ush };
  }

  const createSync = useCallback(async () => {
    setSyncStatus('connecting');
    setSyncError(null);
    try {
      const { stats: currentStats, history: currentHistory } = stateRef.current;
      const code = await createSyncCode(currentStats, currentHistory, currentExtras());
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
      const merged = await connectToSyncCode(code, currentStats, currentHistory, currentExtras());
      setStats(merged.stats);
      setHistory(merged.history);
      saveStats(merged.stats);
      saveHistory(merged.history);
      if (merged.dailyChallenge) {
        setDailyChallenge(merged.dailyChallenge);
        saveDailyChallengeState(merged.dailyChallenge);
      }
      if (merged.waterBodyStats) {
        setWaterBodyStats(merged.waterBodyStats);
        saveNamedStats(WATER_BODY_STATS_KEY, merged.waterBodyStats);
      }
      if (merged.waterBodyHistory) {
        setWaterBodyHistory(merged.waterBodyHistory);
        saveGenericHistory(WATER_BODY_HISTORY_KEY, merged.waterBodyHistory);
      }
      if (merged.usStateStats) {
        setUsStateStats(merged.usStateStats);
        saveNamedStats(US_STATE_STATS_KEY, merged.usStateStats);
      }
      if (merged.usStateHistory) {
        setUsStateHistory(merged.usStateHistory);
        saveGenericHistory(US_STATE_HISTORY_KEY, merged.usStateHistory);
      }
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

  // A genuine "start over" — wipes stats AND history for every quiz universe (countries,
  // seas/oceans, US states — all three read as "stats & history" to a player), locally and (if
  // connected) in the shared sync doc too, so a stray/corrupted record (or just wanting a clean
  // slate) doesn't linger on whichever device or code it's currently attached to. Deliberately
  // separate from disconnectSync, which never deletes anything; this always does, sync or no
  // sync. Deliberately does NOT touch the daily-challenge streak (see resetSyncDoc) — that reads
  // as its own separate kind of thing to a player, not "stats" or "history."
  const resetData = useCallback(async () => {
    setStats({});
    setHistory([]);
    saveStats({});
    saveHistory([]);
    setWaterBodyStats({});
    setWaterBodyHistory([]);
    saveNamedStats(WATER_BODY_STATS_KEY, {});
    saveGenericHistory(WATER_BODY_HISTORY_KEY, []);
    setUsStateStats({});
    setUsStateHistory([]);
    saveNamedStats(US_STATE_STATS_KEY, {});
    saveGenericHistory(US_STATE_HISTORY_KEY, []);
    const { syncCode: currentSyncCode } = stateRef.current;
    if (currentSyncCode) {
      await resetSyncDoc(currentSyncCode);
    }
  }, []);

  // Records today's daily-challenge result — folded in here (rather than staying the separate,
  // localStorage-only hook it used to be) specifically so it goes through the same sync pipeline
  // stats/history already do: this hook is the one place that already owns `syncCode` and the
  // live Firestore subscription, so a second independent hook subscribing to the same doc would
  // just be a second listener on the same data instead of a real shared source of truth.
  const completeDailyChallenge = useCallback((correct: boolean) => {
    const { dailyChallenge: prev, syncCode: currentSyncCode } = stateRef.current;
    const todayKey = dailyDateKey();
    if (prev.lastPlayedDateKey === todayKey) return; // already recorded today — don't double-count a re-render/replay
    const yesterdayKey = dailyDateKey(new Date(Date.now() - ONE_DAY_MS));
    const isConsecutive = prev.lastPlayedDateKey === yesterdayKey;
    const streak = correct ? (isConsecutive ? prev.streak + 1 : 1) : 0;
    const next: DailyChallengeState = { lastPlayedDateKey: todayKey, lastPlayedCorrect: correct, streak };

    setDailyChallenge(next);
    saveDailyChallengeState(next);

    if (currentSyncCode) {
      applyDailyChallengeToSync(currentSyncCode, next).catch(() => {
        // Best-effort, same stance as the rest of sync (see the `answer` callback below) — a
        // failed write doesn't disrupt what's already showing locally, and the next successful
        // sync (this device's or another's) reconciles it.
      });
    }
  }, []);

  // Shared by both useGenericQuiz instances below — same shape as `answer`'s completion branch,
  // just parameterized by which pair of SyncDoc fields (and which localStorage keys) this
  // universe uses.
  function handleGenericComplete(
    universeStats: StatsMap,
    statsKey: string,
    historyKey: string,
    setUniverseStats: (s: StatsMap) => void,
    setUniverseHistory: (h: GenericSessionRecord[]) => void,
    syncFields: GenericSyncFields,
    record: GenericSessionRecord,
    results: QuizAnswerResult[],
  ) {
    const { syncCode: currentSyncCode } = stateRef.current;
    if (currentSyncCode) {
      applyGenericSessionToSync(currentSyncCode, syncFields, record, results)
        .then(({ stats: nextStats, history: nextHistory }) => {
          setUniverseStats(nextStats);
          setUniverseHistory(nextHistory);
          saveNamedStats(statsKey, nextStats);
          saveGenericHistory(historyKey, nextHistory);
        })
        .catch(() => {
          // Best-effort, same stance as the rest of sync — see `answer`'s completion branch.
        });
    } else {
      const nextStats = applySessionToStats(universeStats, results);
      setUniverseStats(nextStats);
      saveNamedStats(statsKey, nextStats);
      setUniverseHistory(appendGenericHistory(historyKey, record));
    }
  }

  const waterBody = useGenericQuiz(WATER_BODIES, waterBodyStats, waterBodyHistory, (record, results) =>
    handleGenericComplete(
      stateRef.current.waterBodyStats,
      WATER_BODY_STATS_KEY,
      WATER_BODY_HISTORY_KEY,
      setWaterBodyStats,
      setWaterBodyHistory,
      { statsField: 'waterBodyStats', historyField: 'waterBodyHistory' },
      record,
      results,
    ),
  );

  const usStates = useGenericQuiz(US_STATES, usStateStats, usStateHistory, (record, results) =>
    handleGenericComplete(
      stateRef.current.usStateStats,
      US_STATE_STATS_KEY,
      US_STATE_HISTORY_KEY,
      setUsStateStats,
      setUsStateHistory,
      { statsField: 'usStateStats', historyField: 'usStateHistory' },
      record,
      results,
    ),
  );

  const start = useCallback(
    (nextConfig: QuizConfig) => {
      setConfig(nextConfig);
      setSummary(null);
      setSession(startSession(nextConfig, COUNTRIES, stats));
      playSound('quizStart');
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
          // Same idea: difficulty only means anything for multipleChoice (see
          // QuizConfig.multipleChoiceDifficulty) — 'easy' elsewhere is just a consistent default.
          multipleChoiceDifficulty: next.config.mode === 'multipleChoice' ? next.config.multipleChoiceDifficulty : 'easy',
          scope: next.config.scope,
          continentsKey: continentsKey(next.config.continents),
          totalQuestions: finalSummary.totalQuestions,
          correctCount: finalSummary.correctCount,
          percentCorrect: finalSummary.percentCorrect,
          totalElapsedMs: finalSummary.totalElapsedMs,
        };
        // Compare against history BEFORE this session's own record joins it, so "new best"
        // means beating a previous run, not tying yourself.
        setPersonalBest(
          personalBestFor(
            currentHistory,
            record.mode,
            record.category,
            record.multipleChoiceDifficulty,
            record.scope,
            record.continentsKey,
          ),
        );
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

  // "Actually, that was right" — see QuizScreen's own doc comment on the button that calls this.
  // Only ever touches the answer just given (engine-enforced — see overrideLastResultAsCorrect),
  // so this can't be used to retroactively rewrite some earlier miss from the same session.
  const overrideLastAnswer = useCallback(() => {
    setSession((prev) => (prev ? overrideLastResultAsCorrect(prev) : prev));
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
    dailyChallenge,
    waterBodyStats,
    waterBodyHistory,
    usStateStats,
    usStateHistory,
    waterBody,
    usStates,
    session,
    config,
    summary,
    personalBest,
    start,
    answer,
    skip,
    overrideLastAnswer,
    playAgain,
    goHome,
    completeDailyChallenge,
    syncCode,
    syncStatus,
    syncError,
    createSync,
    connectSync,
    disconnectSync,
    resetData,
  };
}
