import { useState } from 'react';
import { DailyChallengeScreen } from './components/DailyChallengeScreen';
import { HomeScreen } from './components/HomeScreen';
import { LookupScreen } from './components/LookupScreen';
import { MasteryScreen } from './components/MasteryScreen';
import { QuizScreen } from './components/QuizScreen';
import { RecordsScreen } from './components/RecordsScreen';
import { ReviewMapScreen } from './components/ReviewMapScreen';
import { SetupScreen } from './components/SetupScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { SyncScreen } from './components/SyncScreen';
import { UsStatesQuizScreen } from './components/UsStatesQuizScreen';
import { WaterBodyQuizScreen } from './components/WaterBodyQuizScreen';
import { useQuiz } from './hooks/useQuiz';

type Screen = 'home' | 'setup' | 'lookup' | 'mastery' | 'sync' | 'records' | 'daily' | 'waterBodies' | 'usStates';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  // Lets the summary screen's "View records" button jump to RecordsScreen and come straight
  // BACK to that same summary (quiz.summary is untouched) instead of losing it the way changing
  // `screen` to 'records' would — that branch only ever renders when quiz.summary is falsy.
  const [viewingRecordsFromSummary, setViewingRecordsFromSummary] = useState(false);
  // Same detour pattern for "Review map" — ReviewMapScreen just needs this session's own
  // results, not any other quiz state.
  const [reviewingMap, setReviewingMap] = useState(false);
  const quiz = useQuiz();

  if (viewingRecordsFromSummary) {
    return (
      <RecordsScreen
        history={quiz.history}
        waterBodyHistory={quiz.waterBodyHistory}
        usStateHistory={quiz.usStateHistory}
        onBack={() => setViewingRecordsFromSummary(false)}
      />
    );
  }

  if (reviewingMap && quiz.summary) {
    return <ReviewMapScreen results={quiz.summary.results} onBack={() => setReviewingMap(false)} />;
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
        onReviewMap={() => setReviewingMap(true)}
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
    return (
      <MasteryScreen
        stats={quiz.stats}
        waterBodyStats={quiz.waterBodyStats}
        usStateStats={quiz.usStateStats}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'records') {
    return (
      <RecordsScreen
        history={quiz.history}
        waterBodyHistory={quiz.waterBodyHistory}
        usStateHistory={quiz.usStateHistory}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'daily') {
    return <DailyChallengeScreen dailyChallenge={quiz.dailyChallenge} onComplete={quiz.completeDailyChallenge} onBack={() => setScreen('home')} />;
  }

  if (screen === 'waterBodies') {
    return (
      <WaterBodyQuizScreen
        quiz={quiz.waterBody}
        stats={quiz.waterBodyStats}
        onViewRecords={() => setScreen('records')}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'usStates') {
    return (
      <UsStatesQuizScreen
        quiz={quiz.usStates}
        stats={quiz.usStateStats}
        onViewRecords={() => setScreen('records')}
        onBack={() => setScreen('home')}
      />
    );
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
        onReset={quiz.resetData}
      />
    );
  }

  return (
    <HomeScreen
      dailyChallenge={quiz.dailyChallenge}
      onStartQuiz={() => setScreen('setup')}
      onBrowse={() => setScreen('lookup')}
      onMasteryMap={() => setScreen('mastery')}
      onRecords={() => setScreen('records')}
      onDaily={() => setScreen('daily')}
      onSync={() => setScreen('sync')}
      onWaterBodies={() => setScreen('waterBodies')}
      onUsStates={() => setScreen('usStates')}
      syncStatus={quiz.syncStatus}
      syncCode={quiz.syncCode}
    />
  );
}
