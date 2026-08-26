import { useEffect, useMemo, useRef, useState } from 'react';
import { GenericAnswer, masteryLevel, QuizAnswerResult, StatsMap, US_STATE_BY_ID, US_STATES, UsStateDef } from '@worldly/engine';
import { getUsStateMarkers, getUsStateRegions, PointMarker, UsStateRegion } from '../lib/geo';
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
const SHOW_BORDERS_KEY = 'worldlyUsStatesShowBorders';

function loadShowBorders(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_BORDERS_KEY);
    return raw === null ? true : raw === 'true'; // borders on by default
  } catch {
    return true;
  }
}

function saveShowBorders(value: boolean): void {
  try {
    localStorage.setItem(SHOW_BORDERS_KEY, String(value));
  } catch {
    // ignore — just a display preference, no worse than not remembering it
  }
}

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
 * WaterBodyQuizScreen. Two ways to find a state on the map (`showBorders`, a player-chosen
 * toggle, persisted): real bordered/tappable state shapes (`getUsStateRegions` — see
 * UsStateRegion's doc comment in geo.ts, sourced from `us-atlas`), or the original marker-dot
 * approach (`getUsStateMarkers`, one dot per capital) also used by the seas/oceans quiz, which
 * has no real boundary data available at all and so has no borders option.
 *
 * `quiz`/`stats` come from useQuiz.ts, which owns persistence/sync for this universe — this
 * component is purely presentational over that controller, same relationship QuizScreen has to
 * useQuiz's country-quiz state. */
export function UsStatesQuizScreen({ quiz, stats, onViewRecords, onBack }: UsStatesQuizScreenProps) {
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [markers, setMarkers] = useState<PointMarker[]>([]);
  const [regions, setRegions] = useState<UsStateRegion[]>([]);
  const [showBorders, setShowBorders] = useState<boolean>(loadShowBorders);
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
    getUsStateRegions().then((loaded) => {
      if (!cancelled) setRegions(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleShowBorders(value: boolean) {
    setShowBorders(value);
    saveShowBorders(value);
  }

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
            All 50 states, with real state borders on the map — or switch to simple marker dots below if you'd
            rather.
          </p>

          <label className="start-screen__label">
            Map style
            <div className="start-screen__options">
              <button type="button" className={showBorders ? 'active' : ''} onClick={() => toggleShowBorders(true)}>
                With borders
              </button>
              <button type="button" className={!showBorders ? 'active' : ''} onClick={() => toggleShowBorders(false)}>
                Dots only
              </button>
            </div>
          </label>

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
  // Same rule as the country quiz's skip button: no-op once feedback's showing or only one
  // question is left — skipping the last question would have nothing to swap it with.
  const canSkip = !!current && !feedback && session.remaining.length > 1;

  // Shared by both the marker-dot and real-border rendering — same state, same rules,
  // regardless of which the player's picked (see `showBorders`), just keyed by id instead of by
  // a specific PointMarker/UsStateRegion shape.
  function fillForId(id: string): string {
    if (feedback && id === feedback.countryId) {
      return feedback.correct ? 'var(--map-correct)' : 'var(--map-wrong)';
    }
    if (mode === 'typeIt' && current && id === current.id) {
      return 'var(--map-target)';
    }
    const prior = resultById.get(id);
    if (prior === true) return 'var(--map-answered)';
    if (prior === false) return 'var(--map-missed)';
    return 'var(--map-land)';
  }
  function markerFillFor(marker: PointMarker): string {
    return fillForId(marker.id);
  }
  function regionFillFor(region: UsStateRegion): string {
    return fillForId(region.id);
  }

  // Once a state's been answered (this question's own feedback flash, or any earlier one this
  // session), stamp its flag for the rest of the session — the state-quiz equivalent of
  // QuizScreen's flagFor, building "learn the flags" out of ordinary play instead of a dedicated
  // mode. Skipped for the 'flag' category specifically, same reason as there: the flag was
  // already the prompt for that question, so showing it again wouldn't teach anything.
  function imageForId(id: string): string | null {
    if (activeCategory === 'flag') return null;
    const alreadyAnswered = (feedback && id === feedback.countryId) || resultById.has(id);
    if (!alreadyAnswered) return null;
    const state = US_STATE_BY_ID[id];
    return state ? flagSrc(state) : null;
  }
  function markerImageFor(marker: PointMarker): string | null {
    return imageForId(marker.id);
  }
  function regionImageFor(region: UsStateRegion): string | null {
    return imageForId(region.id);
  }

  function handleTapId(id: string) {
    if (!current || mode !== 'findIt' || feedback) return;
    const answer: GenericAnswer = { type: 'findIt', clickedId: id };
    quiz.answer(answer);
  }
  function handleMarkerTap(marker: PointMarker) {
    handleTapId(marker.id);
  }
  function handleRegionTap(region: UsStateRegion) {
    handleTapId(region.id);
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
          <>
            {promptLead()}
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
        )}
      </div>

      {/* Real land, flat neutral color — background context underneath either layer below (a
          real US-state shape, when showBorders, still needs the rest of the world drawn in
          around it). */}
      {showBorders ? (
        <WorldMap
          fillFor={() => 'var(--map-land)'}
          regions={regions}
          regionFillFor={regionFillFor}
          regionImageFor={regionImageFor}
          onRegionTap={handleRegionTap}
          showCountryMarkers={false}
        />
      ) : (
        <WorldMap
          fillFor={() => 'var(--map-land)'}
          markers={markers}
          markerFillFor={markerFillFor}
          markerImageFor={markerImageFor}
          onMarkerTap={handleMarkerTap}
          showCountryMarkers={false}
        />
      )}

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
