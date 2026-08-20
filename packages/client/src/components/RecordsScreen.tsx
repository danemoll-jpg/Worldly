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
 * study tool, no other players — "personal" is the operative word here, not competitive. */
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
          Best time and best accuracy for every quiz setup you've completed — a full-world quiz
          and a weak-spots-only quiz aren't the same challenge, so each setup keeps its own
          record.
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
                  <span className="records-list__stat" title="Best time">
                    ⏱ {formatDuration(r.bestTimeMs)}
                  </span>
                  <span className="records-list__stat" title="Best accuracy">
                    🎯 {r.bestAccuracy}%
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
