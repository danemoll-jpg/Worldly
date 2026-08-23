import { useState } from 'react';
import { DailyChallengeScreen } from './components/DailyChallengeScreen';
import { HomeScreen } from './components/HomeScreen';
import { LookupScreen } from './components/LookupScreen';
import { MasteryScreen } from './components/MasteryScreen';
import { QuizScreen } from './components/QuizScreen';
import { RecordsScreen } from './components/RecordsScreen';
import { SetupScreen } from './components/SetupScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { SyncScreen } from './components/SyncScreen';
import { useQuiz } from './hooks/useQuiz';

type Screen = 'home' | 'setup' | 'lookup' | 'mastery' | 'sync' | 'records' | 'daily';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  // Lets the summary screen's "View records" button jump to RecordsScreen and come straight
  // BACK to that same summary (quiz.summary is untouched) instead of losing it the way changing
  // `screen` to 'records' would — that branch only ever renders when quiz.summary is falsy.
  const [viewingRecordsFromSummary, setViewingRecordsFromSummary] = useState(false);
  const quiz = useQuiz();

  if (viewingRecordsFromSummary) {
    return <RecordsScreen history={quiz.history} onBack={() => setViewingRecordsFromSummary(false)} />;
  }

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
        onViewRecords={() => setViewingRecordsFromSummary(true)}
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
        onSkip={quiz.skip}
        onQuit={() => {
          quiz.goHome();
          setScreen('home');
        }}
        onRestart={quiz.playAgain}
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

  if (screen === 'records') {
    return <RecordsScreen history={quiz.history} onBack={() => setScreen('home')} />;
  }

  if (screen === 'daily') {
    return <DailyChallengeScreen onBack={() => setScreen('home')} />;
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
      onRecords={() => setScreen('records')}
      onDaily={() => setScreen('daily')}
      onSync={() => setScreen('sync')}
      syncStatus={quiz.syncStatus}
      syncCode={quiz.syncCode}
    />
  );
}
