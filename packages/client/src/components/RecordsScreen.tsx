import { useMemo } from 'react';
import { describeConfig, describeGenericConfig, formatDuration } from '../lib/format';
import { GenericConfigRecord, GenericSessionRecord, groupGenericHistoryByConfig, groupHistoryByConfig, SessionRecord } from '../lib/storage';

interface RecordsScreenProps {
  history: SessionRecord[];
  waterBodyHistory: GenericSessionRecord[];
  usStateHistory: GenericSessionRecord[];
  onBack: () => void;
}

function GenericRecordsList({ records }: { records: GenericConfigRecord[] }) {
  return (
    <ul className="records-list">
      {records.map((r) => (
        <li key={`${r.mode}|${r.scope}|${r.category}`}>
          <div className="records-list__config">
            <span className="records-list__label">{describeGenericConfig(r.mode, r.scope, r.category)}</span>
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
            <span className="records-list__stat" title="Items in the pool that run">
              🔢 {r.bestTotalQuestions}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Personal bests, one row per distinct quiz setup you've actually completed (a full-world
 * find-it run and a full-world type-it run aren't comparable, so this is a list of separate
 * records rather than one ranking) — "personal" is the operative word here, not competitive.
 * For the global, other-players-included comparison, see LeaderboardScreen instead, which only
 * covers the one standard full-quiz setup per quiz type rather than every setup you've played.
 *
 * Covers all three quiz universes (countries, seas/oceans, US states) as three separate
 * sections — a records list is inherently "records within one comparable universe," so these
 * were never going to merge into one ranked list even before there were three universes to
 * choose from.
 *
 * Each record is a single best SESSION, ranked by accuracy first and time only as a tiebreaker
 * (see isBetterSession in storage.ts) — not independent best-time/best-accuracy numbers.
 * Weak-spots quizzes never show up here at all (see groupHistoryByConfig): that pool of
 * countries isn't fixed the way a region is, so even a "best time" shown as a tiebreaker isn't
 * really the same measurement session to session. */
export function RecordsScreen({ history, waterBodyHistory, usStateHistory, onBack }: RecordsScreenProps) {
  const records = useMemo(() => groupHistoryByConfig(history), [history]);
  const waterBodyRecords = useMemo(() => groupGenericHistoryByConfig(waterBodyHistory), [waterBodyHistory]);
  const usStateRecords = useMemo(() => groupGenericHistoryByConfig(usStateHistory), [usStateHistory]);

  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <h1>🏅 Your records</h1>
        <p className="start-screen__subtitle">
          Your best run for every quiz setup you've completed, ranked by accuracy first and time
          as a tiebreaker — each setup keeps its own record. Weak-spots quizzes aren't included:
          that pool changes as you improve, so a "record" for it wouldn't really be comparing the
          same thing session to session.
        </p>

        <h2 className="records-section-heading">🌍 Countries</h2>
        {records.length === 0 ? (
          <p className="start-screen__hint">You haven't finished a country quiz yet.</p>
        ) : (
          <ul className="records-list">
            {records.map((r) => (
              <li key={`${r.mode}|${r.category}|${r.multipleChoiceDifficulty}|${r.scope}|${r.continentsKey}`}>
                <div className="records-list__config">
                  <span className="records-list__label">
                    {describeConfig(r.mode, r.category, r.multipleChoiceDifficulty, r.scope, r.continentsKey)}
                  </span>
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

        <h2 className="records-section-heading">🌊 Seas &amp; oceans</h2>
        {waterBodyRecords.length === 0 ? (
          <p className="start-screen__hint">You haven't finished a seas &amp; oceans quiz yet.</p>
        ) : (
          <GenericRecordsList records={waterBodyRecords} />
        )}

        <h2 className="records-section-heading">🇺🇸 US states</h2>
        {usStateRecords.length === 0 ? (
          <p className="start-screen__hint">You haven't finished a US states quiz yet.</p>
        ) : (
          <GenericRecordsList records={usStateRecords} />
        )}
      </div>
    </div>
  );
}
