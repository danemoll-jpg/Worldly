import { useEffect, useMemo, useRef, useState } from 'react';
import { Answer, COUNTRY_BY_ID, QuizAnswerResult, QuizSessionState } from '@worldly/engine';
import { ConfirmDialog } from './ConfirmDialog';
import { MapFeature } from '../lib/geo';
import { WorldMap } from './WorldMap';

interface QuizScreenProps {
  session: QuizSessionState;
  onAnswer: (answer: Answer) => void;
  onSkip: () => void;
  onQuit: () => void;
  /** Same config, fresh session — throws away every answer given so far this attempt, which is
   * exactly why QuizScreen gates it behind a confirm dialog rather than firing it straight from
   * the button. */
  onRestart: () => void;
}

interface Feedback {
  result: QuizAnswerResult;
}

const FEEDBACK_DISPLAY_MS = 1200;

export function QuizScreen({ session, onAnswer, onSkip, onQuit, onRestart }: QuizScreenProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const seenResultCount = useRef(0);
  // Correctness per already-answered country this session — each country is asked at most
  // once, so this is a plain 1:1 map, not a running tally.
  const resultByCountry = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of session.results) m.set(r.countryId, r.correct);
    return m;
  }, [session.results]);

  // A new result landed (either mode) — flash brief correct/wrong feedback, then let it fade.
  // The underlying question has already advanced by the time this fires; the feedback is just
  // a transient overlay on top, not something that blocks or delays progress.
  useEffect(() => {
    if (session.results.length > seenResultCount.current) {
      const result = session.results[session.results.length - 1];
      seenResultCount.current = session.results.length;
      setFeedback({ result });
      setTypedAnswer('');
      const timer = setTimeout(() => setFeedback(null), FEEDBACK_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
    seenResultCount.current = session.results.length;
  }, [session.results]);

  // Skipping swaps `current` without adding a result (the effect above only fires on an
  // answer), so a typed-but-unsubmitted answer needs its own reset tied directly to which
  // country is being asked about right now.
  useEffect(() => {
    setTypedAnswer('');
  }, [session.current?.country.id]);

  const current = session.current;
  const totalInSession = session.pool.length;
  const questionNumber = session.askedIds.length + (current ? 1 : 0);

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    if (feedback && feature.id === feedback.result.countryId) {
      return feedback.result.correct ? 'var(--map-correct)' : 'var(--map-wrong)';
    }
    if (session.config.mode === 'typeIt' && current && feature.id === current.country.id) {
      return 'var(--map-target)';
    }
    const priorResult = resultByCountry.get(feature.id);
    if (priorResult === true) return 'var(--map-answered)';
    if (priorResult === false) return 'var(--map-missed)';
    return 'var(--map-land)';
  }

  function handleMapTap(feature: MapFeature) {
    if (!current || session.config.mode !== 'findIt' || !feature.quizzable || feedback) return;
    onAnswer({ type: 'findIt', clickedCountryId: feature.id });
  }

  function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || feedback || !typedAnswer.trim()) return;
    onAnswer({ type: 'typeIt', submittedAnswer: typedAnswer });
  }

  const canSkip = !!current && !feedback && session.remaining.length > 1;

  return (
    <div className="app">
      <div className="quiz-header">
        <div className="quiz-header__left">
          <button type="button" className="back-link" onClick={onQuit}>
            ‹ Quit quiz
          </button>
          <button type="button" className="quiz-restart" onClick={() => setConfirmingRestart(true)}>
            ↺ Restart
          </button>
        </div>
        <span className="quiz-header__progress">
          {Math.min(questionNumber, totalInSession)} / {totalInSession}
        </span>
      </div>

      <div className="quiz-prompt">
        {feedback ? (
          <span className={feedback.result.correct ? 'quiz-prompt__feedback quiz-prompt__feedback--correct' : 'quiz-prompt__feedback quiz-prompt__feedback--wrong'}>
            {feedback.result.correct ? '✅ Correct!' : `❌ That was ${COUNTRY_BY_ID[feedback.result.countryId]?.name}`}
          </span>
        ) : current ? (
          <>
            {session.config.mode === 'findIt' ? (
              <span>
                Find: <strong>{current.country.name}</strong>
              </span>
            ) : (
              <span>What country is highlighted?</span>
            )}
            <button type="button" className="quiz-skip" onClick={onSkip} disabled={!canSkip} title="Come back to this one later in the session">
              Skip for now ⤼
            </button>
          </>
        ) : null}
      </div>

      <WorldMap fillFor={fillFor} onCountryTap={handleMapTap} />

      {session.config.mode === 'typeIt' && current && (
        <form className="quiz-answer-form" onSubmit={handleTypeSubmit}>
          <input
            type="text"
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder="Type the country's name…"
            disabled={!!feedback}
            autoFocus
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" disabled={!!feedback || !typedAnswer.trim()}>
            Submit
          </button>
        </form>
      )}

      {confirmingRestart && (
        <ConfirmDialog
          title="Restart this quiz?"
          message={
            session.results.length > 0
              ? `You've answered ${session.results.length} of ${totalInSession} so far — restarting throws that away and starts the same setup over from question 1.`
              : "Start this setup over from question 1?"
          }
          confirmLabel="Restart"
          onConfirm={() => {
            setConfirmingRestart(false);
            onRestart();
          }}
          onCancel={() => setConfirmingRestart(false)}
        />
      )}
    </div>
  );
}
