import { useState } from 'react';
import { SyncStatus } from '../hooks/useQuiz';

interface SyncScreenProps {
  syncCode: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  onBack: () => void;
  onCreate: () => void;
  onConnect: (code: string) => void;
  onDisconnect: () => void;
}

/** Cross-device sync setup — a shared code (no account, same trust model as an online room
 * code elsewhere in this series) that ties your stats and history to a Firestore document
 * instead of just this one browser's localStorage. Purely additive: everything works locally
 * with zero setup either way. */
export function SyncScreen({ syncCode, syncStatus, syncError, onBack, onCreate, onConnect, onDisconnect }: SyncScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

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
          Keep your stats and history the same across every device — no account, just a code you enter on each one.
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
      </div>
    </div>
  );
}
