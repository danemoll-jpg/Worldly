import { useEffect, useMemo, useRef, useState } from 'react';
import { GenericAnswer, masteryLevel, QuizAnswerResult, StatsMap, WaterBodyDef, WATER_BODIES, WATER_BODY_BY_ID } from '@worldly/engine';
import { getWaterBodyMarkers, PointMarker } from '../lib/geo';
import { GenericQuizController } from '../hooks/useGenericQuiz';
import { isBetterSession } from '../lib/storage';
import { WorldMap } from './WorldMap';

interface WaterBodyQuizScreenProps {
  quiz: GenericQuizController<WaterBodyDef>;
  stats: StatsMap;
  onViewRecords: () => void;
  onBack: () => void;
}

const FEEDBACK_DISPLAY_MS = 1200;

/** "Find the ocean/sea on the map, or type its name" — the water equivalent of the country
 * quiz, built on the shared genericSession/useGenericQuiz machinery instead of session.ts's
 * (country-specific) one. See waterBodies.ts's doc comment for why these are marker points, not
 * real boundary shapes: bodies of water nest (the Mediterranean is part of the Atlantic) and
 * have conventional, fuzzy boundaries, so a findable point sidesteps that entirely instead of
 * mis-claiming a precise border. Self-contained (setup → play → summary in one screen) rather
 * than reusing SetupScreen/QuizScreen/SummaryScreen — those were built around the country quiz's
 * much larger config surface (category, continents, multiple-choice difficulty); this quiz's
 * surface is just mode + scope.
 *
 * `quiz`/`stats` come from useQuiz.ts, which owns persistence/sync for this universe — this
 * component is purely presentational over that controller, same relationship QuizScreen has to
 * useQuiz's country-quiz state. */
export function WaterBodyQuizScreen({ quiz, stats, onViewRecords, onBack }: WaterBodyQuizScreenProps) {
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [markers, setMarkers] = useState<PointMarker[]>([]);
  const [pendingMode, setPendingMode] = useState<'findIt' | 'typeIt'>('findIt');
  const [pendingScope, setPendingScope] = useState<'all' | 'weakSpots'>('all');
  const seenResultCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getWaterBodyMarkers().then((loaded) => {
      if (!cancelled) setMarkers(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const session = quiz.session;

  const resultById = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of session?.results ?? []) m.set(r.countryId, r.correct);
    return m;
  }, [session?.results]);

  useEffect(() => {
    if (!session) return;
    if (session.results.length > seenResultCount.current) {
      const result = session.results[session.results.length - 1];
      seenResultCount.current = session.results.length;
      setFeedback(result);
      setTypedAnswer('');
      const timer = setTimeout(() => setFeedback(null), FEEDBACK_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
    seenResultCount.current = session.results.length;
  }, [session, session?.results]);

  useEffect(() => {
    setTypedAnswer('');
  }, [session?.current?.id]);

  const weakSpotCount = useMemo(
    () => WATER_BODIES.filter((w) => { const l = masteryLevel(stats[w.id]); return l === 'shaky' || l === 'struggling'; }).length,
    [stats],
  );

  if (!session) {
    return (
      <div className="start-screen">
        <div className="start-screen__card">
          <button type="button" className="back-link" onClick={onBack}>
            ‹ Back
          </button>
          <h1>🌊 Seas & oceans</h1>
          <p className="start-screen__subtitle">
            Find the 5 oceans and {WATER_BODIES.length - 5} major seas — marked with a dot at roughly their center rather
            than a claimed exact boundary, since real ones nest and blur together (the Mediterranean is part of the
            Atlantic, for instance).
          </p>

          <label className="start-screen__label">
            How do you want to be quizzed?
            <div className="start-screen__options">
              <button type="button" className={pendingMode === 'findIt' ? 'active' : ''} onClick={() => setPendingMode('findIt')}>
                Find it on the map
              </button>
              <button type="button" className={pendingMode === 'typeIt' ? 'active' : ''} onClick={() => setPendingMode('typeIt')}>
                Type its name
              </button>
            </div>
          </label>

          <label className="start-screen__label">
            Which bodies of water?
            <div className="start-screen__options">
              <button type="button" className={pendingScope === 'all' ? 'active' : ''} onClick={() => setPendingScope('all')}>
                Everything
              </button>
              <button
                type="button"
                className={pendingScope === 'weakSpots' ? 'active' : ''}
                disabled={weakSpotCount === 0}
                onClick={() => setPendingScope('weakSpots')}
              >
                Just my weak spots
              </button>
            </div>
            <span className="start-screen__hint">
              {weakSpotCount === 0
                ? 'Nothing currently shaky or struggling — take a full quiz first and this unlocks.'
                : `${weakSpotCount} currently shaky or struggling.`}
            </span>
          </label>

          <button type="button" className="start-screen__submit" onClick={() => quiz.start(pendingMode, pendingScope)}>
            Start quiz
          </button>
        </div>
      </div>
    );
  }

  const current = session.current;
  const totalInSession = session.pool.length;
  const questionNumber = session.askedIds.length + (current ? 1 : 0);
  const mode = session.mode;
  // Same rule as the country quiz's skip button: no-op (and hidden as disabled rather than
  // hidden entirely, so the layout doesn't jump) once feedback's showing or only one question
  // is left — skipping the last question would have nothing to swap it with.
  const canSkip = !!current && !feedback && session.remaining.length > 1;

  function markerFillFor(marker: PointMarker): string {
    if (feedback && marker.id === feedback.countryId) {
      return feedback.correct ? 'var(--map-correct)' : 'var(--map-wrong)';
    }
    if (mode === 'typeIt' && current && marker.id === current.id) {
      return 'var(--map-target)';
    }
    const prior = resultById.get(marker.id);
    if (prior === true) return 'var(--map-answered)';
    if (prior === false) return 'var(--map-missed)';
    return 'var(--map-land)';
  }

  function handleMarkerTap(marker: PointMarker) {
    if (!current || mode !== 'findIt' || feedback) return;
    const answer: GenericAnswer = { type: 'findIt', clickedId: marker.id };
    quiz.answer(answer);
  }

  function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || feedback || !typedAnswer.trim()) return;
    quiz.answer({ type: 'typeIt', submittedAnswer: typedAnswer });
  }

  if (quiz.summary) {
    const summary = quiz.summary;
    const isNewBest = !quiz.personalBest || isBetterSession(summary, quiz.personalBest);
    const misses = summary.results.filter((r) => !r.correct);
    return (
      <div className="app">
        <div className="game-over">
          <div className="game-over__card">
            <div className="game-over__emoji">🌊</div>
            <h2>
              Quiz complete!
              {isNewBest && <span className="new-record-badge">🏅 New best for this setup!</span>}
            </h2>

            <div className="summary-stats">
              <div className="summary-stat">
                <span className="summary-stat__value">{summary.percentCorrect}%</span>
                <span className="summary-stat__label">Correct</span>
              </div>
              <div className="summary-stat">
                <span className="summary-stat__value">
                  {summary.correctCount}/{summary.totalQuestions}
                </span>
                <span className="summary-stat__label">Score</span>
              </div>
            </div>

            {misses.length > 0 && (
              <div className="summary-misses">
                <h3>Missed this round</h3>
                <ul>
                  {misses.map((m) => (
                    <li key={m.countryId}>{WATER_BODY_BY_ID[m.countryId]?.name ?? m.countryId}</li>
                  ))}
                </ul>
                <p className="summary-misses__hint">These are now in your "weak spots" pool for next time.</p>
              </div>
            )}

            <div className="game-over__actions">
              <button type="button" className="game-over__button" onClick={quiz.playAgain}>
                🔁 Play again
              </button>
              <button type="button" className="game-over__button game-over__button--secondary" onClick={onViewRecords}>
                🏅 Records
              </button>
              <button
                type="button"
                className="game-over__button game-over__button--secondary"
                onClick={() => {
                  quiz.goHome();
                  onBack();
                }}
              >
                🏠 Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="quiz-header">
        <button
          type="button"
          className="back-link"
          onClick={() => {
            quiz.goHome();
            onBack();
          }}
        >
          ‹ Quit quiz
        </button>
        <span className="quiz-header__progress">
          {Math.min(questionNumber, totalInSession)} / {totalInSession}
        </span>
      </div>

      <div className="quiz-prompt">
        {feedback ? (
          <span className={feedback.correct ? 'quiz-prompt__feedback quiz-prompt__feedback--correct' : 'quiz-prompt__feedback quiz-prompt__feedback--wrong'}>
            {feedback.correct ? '✅ Correct!' : `❌ That was ${WATER_BODY_BY_ID[feedback.countryId]?.name}`}
          </span>
        ) : current ? (
          <>
            <span>{mode === 'findIt' ? <>Find: <strong>{current.name}</strong></> : 'What body of water is highlighted?'}</span>
            <button
              type="button"
              className="quiz-skip"
              onClick={quiz.skip}
              disabled={!canSkip}
              title="Come back to this one later in the session"
            >
              Skip for now ⤼
            </button>
          </>
        ) : null}
      </div>

      {/* Real land, in a flat neutral color — background context only (there's nothing to tap
          on the landmass itself for this quiz, just the water markers on top of it). */}
      <WorldMap
        fillFor={() => 'var(--map-land)'}
        markers={markers}
        markerFillFor={markerFillFor}
        onMarkerTap={handleMarkerTap}
        showCountryMarkers={false}
      />

      {mode === 'typeIt' && current && (
        <form className="quiz-answer-form" onSubmit={handleTypeSubmit}>
          <input
            type="text"
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder="Type its name…"
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
    </div>
  );
}
