import { useEffect, useMemo, useRef, useState } from 'react';
import { GenericAnswer, masteryLevel, QuizAnswerResult, StatsMap, US_STATE_BY_ID, US_STATES, UsStateDef } from '@worldly/engine';
import { getUsStateMarkers, PointMarker } from '../lib/geo';
import { GenericQuizController } from '../hooks/useGenericQuiz';
import { isBetterSession } from '../lib/storage';
import { WorldMap } from './WorldMap';

interface UsStatesQuizScreenProps {
  quiz: GenericQuizController<UsStateDef>;
  stats: StatsMap;
  onViewRecords: () => void;
  onBack: () => void;
}

type Category = 'name' | 'flag' | 'capital';

const FEEDBACK_DISPLAY_MS = 1200;

function flagSrc(state: UsStateDef): string {
  return `${import.meta.env.BASE_URL}data/flags/us-states/${state.id.toLowerCase()}.svg`;
}

function promptFor(category: Category, state: UsStateDef): { kind: 'text' | 'flag'; content: string } {
  if (category === 'flag') return { kind: 'flag', content: flagSrc(state) };
  if (category === 'capital') return { kind: 'text', content: state.capital };
  return { kind: 'text', content: state.name };
}

/** "Find the state on the map, type its name, or recognize its flag/capital" — the US-states
 * equivalent of the country quiz, on the same shared genericSession/useGenericQuiz machinery as
 * WaterBodyQuizScreen. See usStates.ts's doc comment for why states are marker points at their
 * capital's coordinates rather than real boundary shapes: `countries-10m.json` only has the USA
 * as one whole-country shape, no internal state borders — the same "no boundary geometry
 * available" situation as seas/oceans, so this reuses the exact same marker approach and the
 * exact same WorldMap `markers` layer (built for that quiz) rather than a second one.
 *
 * `quiz`/`stats` come from useQuiz.ts, which owns persistence/sync for this universe — this
 * component is purely presentational over that controller, same relationship QuizScreen has to
 * useQuiz's country-quiz state. */
export function UsStatesQuizScreen({ quiz, stats, onViewRecords, onBack }: UsStatesQuizScreenProps) {
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [markers, setMarkers] = useState<PointMarker[]>([]);
  const [pendingMode, setPendingMode] = useState<'findIt' | 'typeIt'>('findIt');
  const [pendingScope, setPendingScope] = useState<'all' | 'weakSpots'>('all');
  const [category, setCategory] = useState<Category>('name');
  const seenResultCount = useRef(0);

  const session = quiz.session;

  useEffect(() => {
    let cancelled = false;
    getUsStateMarkers().then((loaded) => {
      if (!cancelled) setMarkers(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    () => US_STATES.filter((s) => { const l = masteryLevel(stats[s.id]); return l === 'shaky' || l === 'struggling'; }).length,
    [stats],
  );

  // The category actually used for this session's own record (see quiz.start below) is whatever
  // was picked BEFORE starting, frozen at that point — session-in-progress category display
  // should track that frozen value (session.config.category), not the setup screen's still-live
  // `category` state, which the player could in principle change again after starting if this
  // screen re-rendered with the setup form still mounted (it doesn't, but this keeps the two
  // concerns cleanly separated regardless).
  const activeCategory = (quiz.config?.category as Category | undefined) ?? category;

  if (!session) {
    return (
      <div className="start-screen">
        <div className="start-screen__card">
          <button type="button" className="back-link" onClick={onBack}>
            ‹ Back
          </button>
          <h1>🇺🇸 US states</h1>
          <p className="start-screen__subtitle">
            All 50 states, marked at their capital city — the map data only has the USA as one whole-country shape, so
            there's no real state border to click, just a findable point.
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
            Quiz me on…
            <div className="start-screen__options">
              <button type="button" className={category === 'name' ? 'active' : ''} onClick={() => setCategory('name')}>
                State names
              </button>
              <button type="button" className={category === 'flag' ? 'active' : ''} onClick={() => setCategory('flag')}>
                🏳️ Flags
              </button>
              <button type="button" className={category === 'capital' ? 'active' : ''} onClick={() => setCategory('capital')}>
                Capitals
              </button>
            </div>
          </label>

          <label className="start-screen__label">
            Which states?
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

          <button type="button" className="start-screen__submit" onClick={() => quiz.start(pendingMode, pendingScope, category)}>
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
  const prompt = current ? promptFor(activeCategory, current) : null;

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
            <div className="game-over__emoji">🇺🇸</div>
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
                    <li key={m.countryId}>{US_STATE_BY_ID[m.countryId]?.name ?? m.countryId}</li>
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

  function promptLead(): React.ReactNode {
    if (!prompt || !current) return null;
    if (mode === 'findIt') {
      if (activeCategory === 'name') {
        return (
          <span>
            Find: <strong>{current.name}</strong>
          </span>
        );
      }
      const label = activeCategory === 'flag' ? 'this flag' : 'the capital';
      return (
        <span>
          Find the state with {label}:{' '}
          {prompt.kind === 'flag' ? <img className="quiz-prompt__state-flag" src={prompt.content} alt="" /> : <strong>{prompt.content}</strong>}
        </span>
      );
    }
    if (activeCategory === 'name') return <span>What state is highlighted?</span>;
    const question = activeCategory === 'flag' ? 'Whose flag is this?' : 'Which state has this capital?';
    return (
      <span>
        {question} {prompt.kind === 'flag' ? <img className="quiz-prompt__state-flag" src={prompt.content} alt="" /> : <strong>{prompt.content}</strong>}
      </span>
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
            {feedback.correct ? '✅ Correct!' : `❌ That was ${US_STATE_BY_ID[feedback.countryId]?.name}`}
          </span>
        ) : (
          promptLead()
        )}
      </div>

      {/* Real land, flat neutral color — background context (this is where the state markers
          sit) with no interactive country layer of its own. */}
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
            placeholder="Type the state's name…"
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
