import { useState } from 'react';
import { dailyDateKey } from '@worldly/engine';
import { GAME_HUB_URL } from '../lib/hub';
import { DailyChallengeState } from '../lib/storage';
import { isSoundEnabled, setSoundEnabled } from '../lib/sound';
import { SyncStatus } from '../hooks/useQuiz';

interface HomeScreenProps {
  dailyChallenge: DailyChallengeState;
  onStartQuiz: () => void;
  onBrowse: () => void;
  onMasteryMap: () => void;
  onRecords: () => void;
  onLeaderboard: () => void;
  onDaily: () => void;
  onSync: () => void;
  syncStatus: SyncStatus;
  syncCode: string | null;
}

export function HomeScreen({
  dailyChallenge,
  onStartQuiz,
  onBrowse,
  onMasteryMap,
  onRecords,
  onLeaderboard,
  onDaily,
  onSync,
  syncStatus,
  syncCode,
}: HomeScreenProps) {
  const synced = syncStatus === 'synced' && !!syncCode;
  const hasPlayedToday = dailyChallenge.lastPlayedDateKey === dailyDateKey();
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  return (
    <div className="start-screen">
      <a className="back-link back-link--floating" href={GAME_HUB_URL}>
        🎮 All Games
      </a>
      <button
        type="button"
        className="sound-toggle sound-toggle--floating"
        onClick={toggleSound}
        title={soundOn ? 'Sound on — tap to mute' : 'Sound off — tap to unmute'}
      >
        {soundOn ? '🔊' : '🔇'}
      </button>
      <div className="start-screen__card">
        <h1>🌍 Worldly</h1>
        <p className="start-screen__subtitle">
          Learn every country on the map — not just the big ones. Pan and zoom a real world map,
          quiz yourself untimed, and drill whatever you keep missing.
        </p>

        <div className="home-screen__choices">
          <button type="button" className="home-screen__choice" onClick={onDaily}>
            <span className="home-screen__choice-emoji">🔥</span>
            <span className="home-screen__choice-title">Daily challenge</span>
            <span className="home-screen__choice-sub">
              {hasPlayedToday
                ? `Done for today — ${dailyChallenge.streak > 0 ? `${dailyChallenge.streak}-day streak` : 'come back tomorrow'}.`
                : 'One shared flag a day — everyone gets the same one.'}
            </span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onStartQuiz}>
            <span className="home-screen__choice-emoji">📝</span>
            <span className="home-screen__choice-title">Start a quiz</span>
            <span className="home-screen__choice-sub">Countries, US states, or seas &amp; oceans — untimed, either way.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onBrowse}>
            <span className="home-screen__choice-emoji">🔎</span>
            <span className="home-screen__choice-title">Browse countries</span>
            <span className="home-screen__choice-sub">Look anything up on the map, no pressure.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onMasteryMap}>
            <span className="home-screen__choice-emoji">🗺️</span>
            <span className="home-screen__choice-title">Mastery map</span>
            <span className="home-screen__choice-sub">See the whole world colored by how solid you are on each country.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onRecords}>
            <span className="home-screen__choice-emoji">🏅</span>
            <span className="home-screen__choice-title">Your records</span>
            <span className="home-screen__choice-sub">Best time and accuracy for every quiz setup you've completed.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onLeaderboard}>
            <span className="home-screen__choice-emoji">🏆</span>
            <span className="home-screen__choice-title">Leaderboard</span>
            <span className="home-screen__choice-sub">See the global top 10 and how you compare.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onSync}>
            <span className="home-screen__choice-emoji">🔄</span>
            <span className="home-screen__choice-title">Sync devices</span>
            <span className="home-screen__choice-sub">
              {synced ? `Synced · code ${syncCode}` : 'Keep stats the same across your devices.'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
