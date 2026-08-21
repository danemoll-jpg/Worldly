import { useEffect, useMemo, useRef, useState } from 'react';
import { Answer, Continent, CONTINENTS, COUNTRY_BY_ID, QuizAnswerResult, QuizSessionState } from '@worldly/engine';
import { ConfirmDialog } from './ConfirmDialog';
import { promptFor } from '../lib/format';
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
  const [hintRevealed, setHintRevealed] = useState(false);
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
  // country is being asked about right now. Same reason the hint has to reset here too —
  // otherwise a hint revealed for one country would still be showing for the next.
  useEffect(() => {
    setTypedAnswer('');
    setHintRevealed(false);
  }, [session.current?.country.id]);

  const current = session.current;
  const totalInSession = session.pool.length;
  const questionNumber = session.askedIds.length + (current ? 1 : 0);
  const { mode, category } = session.config;
  const prompt = current ? promptFor(category, current.country) : null;

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    if (feedback && feature.id === feedback.result.countryId) {
      return feedback.result.correct ? 'var(--map-correct)' : 'var(--map-wrong)';
    }
    // Highlighting the target country on the map is only safe when the prompt is the country's
    // own name — for a flag/capital prompt (or continent mode, which always uses this same
    // fillFor) that highlight would just hand over the answer for free.
    if (mode === 'typeIt' && category === 'country' && current && feature.id === current.country.id) {
      return 'var(--map-target)';
    }
    const priorResult = resultByCountry.get(feature.id);
    if (priorResult === true) return 'var(--map-answered)';
    if (priorResult === false) return 'var(--map-missed)';
    return 'var(--map-land)';
  }

  function handleMapTap(feature: MapFeature) {
    if (!current || mode !== 'findIt' || !feature.quizzable || feedback) return;
    onAnswer({ type: 'findIt', clickedCountryId: feature.id });
  }

  function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || feedback || !typedAnswer.trim()) return;
    onAnswer({ type: 'typeIt', submittedAnswer: typedAnswer });
  }

  function handleContinentPick(continent: Continent) {
    if (!current || feedback) return;
    onAnswer({ type: 'continent', selectedContinent: continent });
  }

  const canSkip = !!current && !feedback && session.remaining.length > 1;
  // Continent mode is already a 6-way multiple choice — a hint would barely make it easier, so
  // it's only offered for findIt/typeIt, where a "just guessing" moment is a real possibility.
  const canHint = mode !== 'continent' && !!current && !feedback;

  function promptLead(): React.ReactNode {
    if (mode === 'continent') {
      return (
        <span>
          Which continent is <strong>{current!.country.name}</strong> in?
        </span>
      );
    }
    if (!prompt) return null;

    // findIt: always "find the country [that has/matching] X on the map". typeIt: always
    // "what country [has/matches] X" — 'country' category keeps its original, simpler v1
    // phrasing (no "matching" framing needed when the prompt already IS the country's name).
    if (mode === 'findIt') {
      if (category === 'country') {
        return (
          <span>
            Find: <strong>{prompt.content}</strong>
          </span>
        );
      }
      const label = category === 'flag' ? 'this flag' : 'the capital';
      return (
        <span>
          Find the country with {label}:{' '}
          {prompt.kind === 'flag' ? <span className="quiz-prompt__flag">{prompt.content}</span> : <strong>{prompt.content}</strong>}
        </span>
      );
    }

    // typeIt
    if (category === 'country') return <span>What country is highlighted?</span>;
    const question = category === 'flag' ? 'Whose flag is this?' : 'Which country has this capital?';
    return (
      <span>
        {question} {prompt.kind === 'flag' ? <span className="quiz-prompt__flag">{prompt.content}</span> : <strong>{prompt.content}</strong>}
      </span>
    );
  }

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
            {promptLead()}
            {canHint &&
              (hintRevealed ? (
                <span className="quiz-hint quiz-hint--revealed">
                  🤔 {current.country.continent} · starts with "{current.country.name[0]}"
                </span>
              ) : (
                <button type="button" className="quiz-hint" onClick={() => setHintRevealed(true)}>
                  🤔 Hint
                </button>
              ))}
            <button type="button" className="quiz-skip" onClick={onSkip} disabled={!canSkip} title="Come back to this one later in the session">
              Skip for now ⤼
            </button>
          </>
        ) : null}
      </div>

      <WorldMap fillFor={fillFor} onCountryTap={handleMapTap} />

      {mode === 'typeIt' && current && (
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

      {mode === 'continent' && current && (
        <div className="quiz-continent-choices">
          {CONTINENTS.map((c) => (
            <button key={c} type="button" disabled={!!feedback} onClick={() => handleContinentPick(c)}>
              {c}
            </button>
          ))}
        </div>
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
