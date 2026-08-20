import { useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { LookupScreen } from './components/LookupScreen';
import { MasteryScreen } from './components/MasteryScreen';
import { QuizScreen } from './components/QuizScreen';
import { SetupScreen } from './components/SetupScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { SyncScreen } from './components/SyncScreen';
import { useQuiz } from './hooks/useQuiz';

type Screen = 'home' | 'setup' | 'lookup' | 'mastery' | 'sync';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const quiz = useQuiz();

  // A quiz in progress or just-finished takes over the whole screen regardless of `screen` —
  // same "active game overrides navigation" shape as the rest of the series, just without a
  // lobby/online layer since this is entirely local (aside from sync, which runs quietly in
  // the background and never blocks play).
  if (quiz.summary && quiz.config) {
    return (
      <SummaryScreen
        summary={quiz.summary}
        config={quiz.config}
        personalBest={quiz.personalBest}
        onPlayAgain={quiz.playAgain}
        onHome={() => {
          quiz.goHome();
          setScreen('home');
        }}
      />
    );
  }

  if (quiz.session) {
    return (
      <QuizScreen
        session={quiz.session}
        onAnswer={quiz.answer}
        onQuit={() => {
          quiz.goHome();
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'setup') {
    return <SetupScreen stats={quiz.stats} onBack={() => setScreen('home')} onStart={quiz.start} />;
  }

  if (screen === 'lookup') {
    return <LookupScreen onBack={() => setScreen('home')} />;
  }

  if (screen === 'mastery') {
    return <MasteryScreen stats={quiz.stats} onBack={() => setScreen('home')} />;
  }

  if (screen === 'sync') {
    return (
      <SyncScreen
        syncCode={quiz.syncCode}
        syncStatus={quiz.syncStatus}
        syncError={quiz.syncError}
        onBack={() => setScreen('home')}
        onCreate={quiz.createSync}
        onConnect={quiz.connectSync}
        onDisconnect={quiz.disconnectSync}
      />
    );
  }

  return (
    <HomeScreen
      onStartQuiz={() => setScreen('setup')}
      onBrowse={() => setScreen('lookup')}
      onMasteryMap={() => setScreen('mastery')}
      onSync={() => setScreen('sync')}
      syncStatus={quiz.syncStatus}
      syncCode={quiz.syncCode}
    />
  );
}
