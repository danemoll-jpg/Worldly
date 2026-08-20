import { useMemo } from 'react';
import { describeConfig, formatDuration } from '../lib/format';
import { groupHistoryByConfig, SessionRecord } from '../lib/storage';

interface RecordsScreenProps {
  history: SessionRecord[];
  onBack: () => void;
}

/** Personal bests, one row per distinct quiz setup you've actually completed — there's no
 * single "top score" for the app (a full-world find-it run and a weak-spots-only type-it run
 * aren't comparable), so this is a list of separate records rather than one leaderboard. Solo
 * study tool, no other players — "personal" is the operative word here, not competitive.
 *
 * Each record is a single best SESSION, ranked by accuracy first and time only as a tiebreaker
 * (see isBetterSession in storage.ts) — not independent best-time/best-accuracy numbers. That
 * matters most for weak spots: the pool of countries in play there shrinks as you improve and
 * grows as you rack up new misses, so a bare time isn't comparable across sessions the way it
 * is for a fixed region. Showing the country count next to the record makes that honest. */
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
          as a tiebreaker — a full-world quiz and a weak-spots-only quiz aren't the same
          challenge, so each setup keeps its own record. Weak-spots records also show how many
          countries were in the pool that run, since that count changes as you improve.
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
