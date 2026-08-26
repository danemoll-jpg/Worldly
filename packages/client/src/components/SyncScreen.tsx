import { useState } from 'react';
import { SyncStatus } from '../hooks/useQuiz';
import { ConfirmDialog } from './ConfirmDialog';

interface SyncScreenProps {
  syncCode: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  onBack: () => void;
  onCreate: () => void;
  onConnect: (code: string) => void;
  onDisconnect: () => void;
  onReset: () => void;
}

/** Cross-device sync setup — a shared code (no account, same trust model as an online room
 * code elsewhere in this series) that ties your stats and history to a Firestore document
 * instead of just this one browser's localStorage. Purely additive: everything works locally
 * with zero setup either way. */
export function SyncScreen({ syncCode, syncStatus, syncError, onBack, onCreate, onConnect, onDisconnect, onReset }: SyncScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  function handleCopy() {
    if (!syncCode) return;
    navigator.clipboard?.writeText(syncCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleConnect() {
    if (!joinCode.trim()) return;
    onConnect(joinCode.trim());
  }

  const connected = syncStatus === 'synced' && !!syncCode;

  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <h1>🔄 Sync devices</h1>
        <p className="start-screen__subtitle">
          Keep your stats and history the same across every device — countries, seas &amp; oceans, US states, and
          your daily-challenge streak, all under one code you enter on each device. No account.
        </p>

        {connected ? (
          <>
            <div className="sync-code-display">
              <span className="sync-code-display__code">{syncCode}</span>
              <button type="button" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="start-screen__hint" style={{ textAlign: 'center' }}>
              Enter this code on your other devices (Sync devices → I have a code) to bring them in. Progress from
              any connected device shows up on all the others.
            </p>
            <button type="button" className="start-screen__submit" onClick={onDisconnect}>
              Disconnect this device
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="start-screen__submit"
              disabled={syncStatus === 'connecting'}
              onClick={onCreate}
            >
              {syncStatus === 'connecting' ? 'Working…' : 'Start syncing 🔄'}
            </button>

            <div className="online-home__divider">or</div>

            <label className="start-screen__label">
              I have a code
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCDEF"
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
              />
            </label>
            <button
              type="button"
              className="start-screen__submit"
              disabled={!joinCode.trim() || syncStatus === 'connecting'}
              onClick={handleConnect}
            >
              Connect
            </button>

            {syncError && <div className="error-banner">{syncError}</div>}
          </>
        )}

        <div className="sync-reset">
          <button type="button" className="sync-reset__button" onClick={() => setConfirmingReset(true)}>
            🗑️ Clear my stats &amp; history
          </button>
          <p className="start-screen__hint">
            Wipes personal bests, session history, and weak-spots tracking back to nothing — for countries, seas
            &amp; oceans, and US states alike — on this device, and in the shared sync doc too if you're connected.
            Doesn't touch your daily-challenge streak, that's its own separate thing. Use this to start clean if
            something's ever looked wrong (a record you don't remember earning, stats you want to redo from
            scratch).
          </p>
        </div>
      </div>

      {confirmingReset && (
        <ConfirmDialog
          title="Clear your stats & history?"
          message={
            connected
              ? "This wipes your personal bests, full session history, and weak-spots tracking — for countries, seas & oceans, and US states — on this device AND on every other device connected to this same sync code. Your daily-challenge streak is untouched. This can't be undone."
              : "This wipes your personal bests, full session history, and weak-spots tracking — for countries, seas & oceans, and US states — on this device. Your daily-challenge streak is untouched. This can't be undone."
          }
          confirmLabel="Clear everything"
          onConfirm={() => {
            onReset();
            setConfirmingReset(false);
          }}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
