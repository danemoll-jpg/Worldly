import { useMemo } from 'react';
import { describeConfig, formatDuration } from '../lib/format';
import { groupHistoryByConfig, SessionRecord } from '../lib/storage';

interface RecordsScreenProps {
  history: SessionRecord[];
  onBack: () => void;
}

/** Personal bests, one row per distinct quiz setup you've actually completed — there's no
 * single "top score" for the app (a full-world find-it run and a full-world type-it run aren't
 * comparable), so this is a list of separate records rather than one leaderboard. Solo study
 * tool, no other players — "personal" is the operative word here, not competitive.
 *
 * Each record is a single best SESSION, ranked by accuracy first and time only as a tiebreaker
 * (see isBetterSession in storage.ts) — not independent best-time/best-accuracy numbers.
 * Weak-spots quizzes never show up here at all (see groupHistoryByConfig): that pool of
 * countries isn't fixed the way a region is, so even a "best time" shown as a tiebreaker isn't
 * really the same measurement session to session. */
export function RecordsScreen({ history, onBack }: RecordsScreenProps) {
  const records = useMemo(() => groupHistoryByConfig(history), [history]);

  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <h1>🏅 Your records</h1>
        <p className="start-screen__subtitle">
          Your best run for every quiz setup you've completed, ranked by accuracy first and time
          as a tiebreaker — each region/mode combo keeps its own record. Weak-spots quizzes
          aren't included: that pool of countries changes as you improve, so a "record" for it
          wouldn't really be comparing the same thing session to session.
        </p>

        {records.length === 0 ? (
          <p className="start-screen__hint">You haven't finished a quiz yet — play one to start building records.</p>
        ) : (
          <ul className="records-list">
            {records.map((r) => (
              <li key={`${r.mode}|${r.scope}|${r.continentsKey}`}>
                <div className="records-list__config">
                  <span className="records-list__label">{describeConfig(r.mode, r.scope, r.continentsKey)}</span>
                  <span className="records-list__meta">
                    {r.timesPlayed} {r.timesPlayed === 1 ? 'time' : 'times'} · last {new Date(r.lastPlayedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="records-list__stats">
                  <span className="records-list__stat" title="Best accuracy">
                    🎯 {r.bestPercentCorrect}%
                  </span>
                  <span className="records-list__stat" title="Time for that run">
                    ⏱ {formatDuration(r.bestTimeMs)}
                  </span>
                  <span className="records-list__stat" title="Countries in the pool that run">
                    🌍 {r.bestTotalQuestions}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
