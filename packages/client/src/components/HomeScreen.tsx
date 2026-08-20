import { GAME_HUB_URL } from '../lib/hub';
import { SyncStatus } from '../hooks/useQuiz';

interface HomeScreenProps {
  onStartQuiz: () => void;
  onBrowse: () => void;
  onMasteryMap: () => void;
  onSync: () => void;
  syncStatus: SyncStatus;
  syncCode: string | null;
}

export function HomeScreen({ onStartQuiz, onBrowse, onMasteryMap, onSync, syncStatus, syncCode }: HomeScreenProps) {
  const synced = syncStatus === 'synced' && !!syncCode;

  return (
    <div className="start-screen">
      <a className="back-link back-link--floating" href={GAME_HUB_URL}>
        🎮 All Games
      </a>
      <div className="start-screen__card">
        <h1>🌍 Worldly</h1>
        <p className="start-screen__subtitle">
          Learn every country on the map — not just the big ones. Pan and zoom a real world map,
          quiz yourself untimed, and drill whatever you keep missing.
        </p>

        <div className="home-screen__choices">
          <button type="button" className="home-screen__choice" onClick={onStartQuiz}>
            <span className="home-screen__choice-emoji">📝</span>
            <span className="home-screen__choice-title">Start a quiz</span>
            <span className="home-screen__choice-sub">Find it on the map, or type its name — untimed, either way.</span>
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
