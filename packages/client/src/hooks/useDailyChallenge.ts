import { useCallback, useState } from 'react';
import { CountryDef, dailyCountry, dailyDateKey } from '@worldly/engine';

const STORAGE_KEY = 'worldlyDailyChallenge';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface DailyChallengeState {
  lastPlayedDateKey: string | null;
  lastPlayedCorrect: boolean | null;
  /** Consecutive days (ending at `lastPlayedDateKey`) with a CORRECT answer — a wrong answer or
   * a skipped day both reset it to 0, same "you have to actually keep it up" spirit as any
   * other daily-streak feature. */
  streak: number;
}

const DEFAULT_STATE: DailyChallengeState = { lastPlayedDateKey: null, lastPlayedCorrect: null, streak: 0 };

function loadState(): DailyChallengeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DailyChallengeState) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: DailyChallengeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — the streak just won't persist, no worse than not having one.
  }
}

/** Not personalized (unlike the rest of the app) — see dailyCountry's doc comment. This hook is
 * just local bookkeeping on top of that: today's deterministic pick, whether it's already been
 * played, and a streak counter for playing (and getting right) consecutive days. */
export function useDailyChallenge(countries: CountryDef[]) {
  const [state, setState] = useState<DailyChallengeState>(loadState);
  const todayKey = dailyDateKey();
  const todaysCountry = dailyCountry(countries, todayKey);
  const hasPlayedToday = state.lastPlayedDateKey === todayKey;

  const complete = useCallback(
    (correct: boolean) => {
      setState((prev) => {
        if (prev.lastPlayedDateKey === todayKey) return prev; // already recorded today — don't double-count a re-render/replay
        const yesterdayKey = dailyDateKey(new Date(Date.now() - ONE_DAY_MS));
        const isConsecutive = prev.lastPlayedDateKey === yesterdayKey;
        const streak = correct ? (isConsecutive ? prev.streak + 1 : 1) : 0;
        const next: DailyChallengeState = { lastPlayedDateKey: todayKey, lastPlayedCorrect: correct, streak };
        saveState(next);
        return next;
      });
    },
    [todayKey],
  );

  return { todaysCountry, hasPlayedToday, lastPlayedCorrect: state.lastPlayedCorrect, streak: state.streak, complete };
}
