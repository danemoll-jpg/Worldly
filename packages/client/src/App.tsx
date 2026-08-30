import { useEffect, useRef, useState } from 'react';
import { SessionSummary } from '@worldly/engine';
import { DailyChallengeScreen } from './components/DailyChallengeScreen';
import { HomeScreen } from './components/HomeScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { LookupScreen } from './components/LookupScreen';
import { MasteryScreen } from './components/MasteryScreen';
import { QuizPickerScreen } from './components/QuizPickerScreen';
import { QuizScreen } from './components/QuizScreen';
import { RecordsScreen } from './components/RecordsScreen';
import { ReviewMapScreen } from './components/ReviewMapScreen';
import { SetupScreen } from './components/SetupScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { SyncScreen } from './components/SyncScreen';
import { UsStatesQuizScreen } from './components/UsStatesQuizScreen';
import { WaterBodyQuizScreen } from './components/WaterBodyQuizScreen';
import { useQuiz } from './hooks/useQuiz';
import { completionSound, playSound } from './lib/sound';
import { isBetterSession } from './lib/storage';

type Screen = 'home' | 'quizPicker' | 'setup' | 'lookup' | 'mastery' | 'sync' | 'records' | 'daily' | 'waterBodies' | 'usStates' | 'leaderboard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  // Lets the summary screen's "View records" button jump to RecordsScreen and come straight
  // BACK to that same summary (quiz.summary is untouched) instead of losing it the way changing
  // `screen` to 'records' would — that branch only ever renders when quiz.summary is falsy.
  const [viewingRecordsFromSummary, setViewingRecordsFromSummary] = useState(false);
  // Same detour pattern for "View leaderboard" from the country quiz's summary screen.
  const [viewingLeaderboardFromSummary, setViewingLeaderboardFromSummary] = useState(false);
  // Same detour pattern for "Review map" — ReviewMapScreen just needs this session's own
  // results, not any other quiz state.
  const [reviewingMap, setReviewingMap] = useState(false);
  const quiz = useQuiz();

  // The quiz-complete cue (plain finish / perfect / new-record) has to play exactly once per
  // finished session, but SummaryScreen itself can't own "have we already played this" — it
  // mounts and unmounts every time "View records"/"View leaderboard"/"Review map" detours away
  // and back (see the early returns below), and the whole point of those detours is that
  // `quiz.summary` is untouched by them, so a fresh SummaryScreen mount looks IDENTICAL to a
  // genuinely new completion from inside the component. App itself never unmounts across that
  // detour, so tracking "the last summary we already played a sound for" here — and only firing
  // when `quiz.summary` actually changes to a NEW object — is what tells "just finished" apart
  // from "came back to look at the same finish screen again."
  const playedSummarySound = useRef<SessionSummary | null>(null);
  useEffect(() => {
    if (!quiz.summary || playedSummarySound.current === quiz.summary) return;
    playedSummarySound.current = quiz.summary;
    const isNewBest = !quiz.personalBest || isBetterSession(quiz.summary, quiz.personalBest);
    playSound(completionSound(quiz.summary.percentCorrect, isNewBest));
  }, [quiz.summary, quiz.personalBest]);

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

  if (viewingLeaderboardFromSummary) {
    return (
      <LeaderboardScreen
        history={quiz.history}
        waterBodyHistory={quiz.waterBodyHistory}
        usStateHistory={quiz.usStateHistory}
        onBack={() => setViewingLeaderboardFromSummary(false)}
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
        onViewLeaderboard={() => setViewingLeaderboardFromSummary(true)}
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
        onOverrideLastAnswer={quiz.overrideLastAnswer}
      />
    );
  }

  if (screen === 'quizPicker') {
    return (
      <QuizPickerScreen
        onCountries={() => setScreen('setup')}
        onUsStates={() => setScreen('usStates')}
        onWaterBodies={() => setScreen('waterBodies')}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'setup') {
    return <SetupScreen stats={quiz.stats} onBack={() => setScreen('quizPicker')} onStart={quiz.start} />;
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

  if (screen === 'leaderboard') {
    return (
      <LeaderboardScreen
        history={quiz.history}
        waterBodyHistory={quiz.waterBodyHistory}
        usStateHistory={quiz.usStateHistory}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'waterBodies') {
    return (
      <WaterBodyQuizScreen
        quiz={quiz.waterBody}
        stats={quiz.waterBodyStats}
        onViewRecords={() => setScreen('records')}
        onViewLeaderboard={() => setScreen('leaderboard')}
        onBack={() => setScreen('home')}
        onBackToPicker={() => setScreen('quizPicker')}
      />
    );
  }

  if (screen === 'usStates') {
    return (
      <UsStatesQuizScreen
        quiz={quiz.usStates}
        stats={quiz.usStateStats}
        onViewRecords={() => setScreen('records')}
        onViewLeaderboard={() => setScreen('leaderboard')}
        onBack={() => setScreen('home')}
        onBackToPicker={() => setScreen('quizPicker')}
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
      onStartQuiz={() => setScreen('quizPicker')}
      onBrowse={() => setScreen('lookup')}
      onMasteryMap={() => setScreen('mastery')}
      onRecords={() => setScreen('records')}
      onLeaderboard={() => setScreen('leaderboard')}
      onDaily={() => setScreen('daily')}
      onSync={() => setScreen('sync')}
      syncStatus={quiz.syncStatus}
      syncCode={quiz.syncCode}
    />
  );
}
