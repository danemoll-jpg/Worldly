import { useEffect, useMemo, useState } from 'react';
import { formatDuration } from '../lib/format';
import { GenericSessionRecord, SessionRecord } from '../lib/storage';
import {
  fetchLeaderboardTop,
  fetchPlayerRank,
  findBestEligibleCountryRecord,
  findBestEligibleGenericRecord,
  LeaderboardEntry,
  LeaderboardQuizType,
  submitLeaderboardScore,
} from '../network/leaderboard';
import { getOrCreatePlayerId, getSavedDisplayName, saveDisplayName } from '../network/leaderboardIdentity';
import { DisplayNamePrompt } from './DisplayNamePrompt';

interface LeaderboardScreenProps {
  history: SessionRecord[];
  waterBodyHistory: GenericSessionRecord[];
  usStateHistory: GenericSessionRecord[];
  onBack: () => void;
}

const TABS: { type: LeaderboardQuizType; label: string; emoji: string }[] = [
  { type: 'countries', label: 'Countries', emoji: '🌍' },
  { type: 'usStates', label: 'US States', emoji: '🇺🇸' },
  { type: 'waterBodies', label: 'Seas & oceans', emoji: '🌊' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

/** Global top-10s, one per quiz type — separate from RecordsScreen's personal bests (which track
 * every setup you've played), since a leaderboard only makes sense as a comparison against the
 * same test everyone else took. See network/leaderboard.ts's eligibility helpers for exactly
 * what "the same test" means here. */
export function LeaderboardScreen({ history, waterBodyHistory, usStateHistory, onBack }: LeaderboardScreenProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardQuizType>('countries');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  // undefined: still loading. null: loaded, but this player has no entry on this board yet.
  const [ownRank, setOwnRank] = useState<{ rank: number; entry: LeaderboardEntry } | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  // Bumped after a successful backfill submission to re-run the fetch effect below for whichever
  // tab is showing, so a just-submitted past score shows up without a manual tab switch.
  const [refreshKey, setRefreshKey] = useState(0);

  // "Check my history" backfill — see handleBackfill's own comment.
  const [backfillState, setBackfillState] = useState<'idle' | 'needsName' | 'running' | 'done'>('idle');
  const [backfillResults, setBackfillResults] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setOwnRank(undefined);
    setLoadError(false);
    Promise.all([fetchLeaderboardTop(activeTab), fetchPlayerRank(activeTab, playerId)])
      .then(([top, rank]) => {
        if (cancelled) return;
        setEntries(top);
        setOwnRank(rank);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, playerId, refreshKey]);

  /** For anyone who already played the standard full quiz (any quiz type) before the leaderboard
   * existed — checks LOCAL history for the best run of each type that would have qualified, and
   * submits whichever ones it finds, so a genuinely good score already on record doesn't just
   * get silently skipped forever for having happened too early. Safe to run more than once:
   * submitLeaderboardScore only ever writes when it's an actual improvement. */
  async function runBackfill(displayName: string) {
    setBackfillState('running');
    const playerIdForSubmit = getOrCreatePlayerId();
    const jobs: { label: string; type: LeaderboardQuizType; record: SessionRecord | GenericSessionRecord | null }[] = [
      { label: 'Countries', type: 'countries', record: findBestEligibleCountryRecord(history) },
      { label: 'US States', type: 'usStates', record: findBestEligibleGenericRecord(usStateHistory) },
      { label: 'Seas & oceans', type: 'waterBodies', record: findBestEligibleGenericRecord(waterBodyHistory) },
    ];
    const results: string[] = [];
    for (const job of jobs) {
      if (!job.record) {
        results.push(`${job.label}: no past full-quiz run found in your history.`);
        continue;
      }
      try {
        const improved = await submitLeaderboardScore(job.type, playerIdForSubmit, displayName, job.record);
        results.push(improved ? `${job.label}: submitted your ${job.record.percentCorrect}% run! 🏆` : `${job.label}: your best (${job.record.percentCorrect}%) is already on the board.`);
      } catch {
        results.push(`${job.label}: couldn't reach the leaderboard — try again later.`);
      }
    }
    setBackfillResults(results);
    setBackfillState('done');
    setRefreshKey((k) => k + 1);
  }

  function handleBackfillClick() {
    const name = getSavedDisplayName();
    if (!name) {
      setBackfillState('needsName');
      return;
    }
    runBackfill(name);
  }

  function handleBackfillName(name: string) {
    saveDisplayName(name);
    runBackfill(name);
  }

  const ownRankShownSeparately = !!ownRank && ownRank.rank > 10;

  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <h1>🏆 Leaderboard</h1>
        <p className="start-screen__subtitle">
          Ranked by best accuracy (time breaks ties) on the standard full quiz — find it on the map, everything included.
          Other modes (weak spots only, flags, typing) aren't counted here, so every entry is the same test.
        </p>

        <div className="start-screen__options">
          {TABS.map((t) => (
            <button key={t.type} type="button" className={activeTab === t.type ? 'active' : ''} onClick={() => setActiveTab(t.type)}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {entries === null ? (
          <p className="start-screen__hint">Loading…</p>
        ) : loadError ? (
          <p className="start-screen__hint">Couldn't reach the leaderboard — check your connection and try again.</p>
        ) : entries.length === 0 ? (
          <p className="start-screen__hint">No scores yet for this one — be the first!</p>
        ) : (
          <ol className="leaderboard-list">
            {entries.map((e, i) => (
              <li key={e.playerId} className={e.playerId === playerId ? 'leaderboard-list__row leaderboard-list__row--you' : 'leaderboard-list__row'}>
                <span className="leaderboard-list__rank">{MEDALS[i] ?? `#${i + 1}`}</span>
                <span className="leaderboard-list__name">
                  {e.displayName}
                  {e.playerId === playerId ? ' (you)' : ''}
                </span>
                <span className="leaderboard-list__score">{e.percentCorrect}%</span>
                <span className="leaderboard-list__time">{formatDuration(e.timeSeconds * 1000)}</span>
              </li>
            ))}
          </ol>
        )}

        {ownRankShownSeparately && ownRank && (
          <p className="leaderboard-own-rank">
            You: #{ownRank.rank} · {ownRank.entry.percentCorrect}% ({formatDuration(ownRank.entry.timeSeconds * 1000)})
          </p>
        )}
        {ownRank === null && entries !== null && entries.length > 0 && (
          <p className="leaderboard-own-rank leaderboard-own-rank--hint">
            You haven't got a score here yet — finish the full {TABS.find((t) => t.type === activeTab)?.label} quiz to show up.
          </p>
        )}

        <div className="leaderboard-backfill">
          {backfillState === 'idle' && (
            <button type="button" className="leaderboard-backfill__trigger" onClick={handleBackfillClick}>
              🔍 Check my past scores for the leaderboard
            </button>
          )}
          {backfillState === 'needsName' && <DisplayNamePrompt onSubmit={handleBackfillName} />}
          {backfillState === 'running' && <p className="start-screen__hint">Checking your history…</p>}
          {backfillState === 'done' && (
            <ul className="leaderboard-backfill__results">
              {backfillResults.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
