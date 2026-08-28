import { useEffect, useMemo, useRef, useState } from 'react';
import { GenericAnswer, masteryLevel, QuizAnswerResult, StatsMap, US_STATE_BY_ID, US_STATES, UsStateDef } from '@worldly/engine';
import { getUsStateRegions, MapRegion } from '../lib/geo';
import { GenericQuizController } from '../hooks/useGenericQuiz';
import { isBetterSession } from '../lib/storage';
import { ConfirmDialog } from './ConfirmDialog';
import { WorldMap } from './WorldMap';

interface UsStatesQuizScreenProps {
  quiz: GenericQuizController<UsStateDef>;
  stats: StatsMap;
  onViewRecords: () => void;
  /** Quitting mid-quiz or finishing — goes all the way home, same as the country quiz's own
   * quit/home buttons. */
  onBack: () => void;
  /** The setup screen's own "‹ Back" button, before a session has started — goes back one level,
   * to the quiz-type picker, not all the way home (see QuizPickerScreen). */
  onBackToPicker: () => void;
}

type Category = 'name' | 'flag' | 'capital';

const FEEDBACK_DISPLAY_MS = 1200;
const SHOW_OUTLINES_KEY = 'worldlyUsStatesShowOutlines';
/** USA's own id in the country map data (see @worldly/engine's countries.ts) — used purely to
 * borrow its centroid for WorldMap's auto-focus (see focusCountryId below), not to make the
 * whole-country shape itself part of this quiz. */
const USA_COUNTRY_ID = '840';

function loadShowOutlines(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_OUTLINES_KEY);
    return raw === null ? true : raw === 'true'; // outlines on by default
  } catch {
    return true;
  }
}

function saveShowOutlines(value: boolean): void {
  try {
    localStorage.setItem(SHOW_OUTLINES_KEY, String(value));
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
 * WaterBodyQuizScreen. Every state is a real, directly-tappable region shape
 * (`getUsStateRegions` — see MapRegion's doc comment in geo.ts, sourced from `us-atlas`); the old
 * marker-dot fallback is gone now that nothing needs it. `showOutlines` (a player-chosen toggle,
 * persisted) only affects whether a state's OUTLINE is visible before it's been answered —
 * tapping anywhere inside a state's real shape always works regardless, so turning outlines off
 * just means the map doesn't visually spoil where each state's border is ahead of time; a
 * state's fill still turns green/red/gold on interaction either way, which naturally reveals its
 * outline through contrast at that point. The map opens already zoomed to the US
 * (`focusCountryId`/`USA_COUNTRY_ID`, reusing the country map's own USA shape purely for its
 * centroid) instead of the whole globe, since that's the only part of the map this quiz ever
 * needs — the player can still freely pan out to Alaska/Hawaii or anywhere else afterward.
 *
 * `quiz`/`stats` come from useQuiz.ts, which owns persistence/sync for this universe — this
 * component is purely presentational over that controller, same relationship QuizScreen has to
 * useQuiz's country-quiz state. */
export function UsStatesQuizScreen({ quiz, stats, onViewRecords, onBack, onBackToPicker }: UsStatesQuizScreenProps) {
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [regions, setRegions] = useState<MapRegion[]>([]);
  const [showOutlines, setShowOutlines] = useState<boolean>(loadShowOutlines);
  const [pendingMode, setPendingMode] = useState<'findIt' | 'typeIt'>('findIt');
  const [pendingScope, setPendingScope] = useState<'all' | 'weakSpots'>('all');
  const [category, setCategory] = useState<Category>('name');
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const seenResultCount = useRef(0);

  const session = quiz.session;

  useEffect(() => {
    let cancelled = false;
    getUsStateRegions().then((loaded) => {
      if (!cancelled) setRegions(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleShowOutlines(value: boolean) {
    setShowOutlines(value);
    saveShowOutlines(value);
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
          <button type="button" className="back-link" onClick={onBackToPicker}>
            ‹ Back
          </button>
          <h1>🇺🇸 US states</h1>
          <p className="start-screen__subtitle">
            All 50 states, with real state borders on the map — the map opens already zoomed to the US.
          </p>

          <label className="start-screen__label">
            Show outlines before you answer?
            <div className="start-screen__options">
              <button type="button" className={showOutlines ? 'active' : ''} onClick={() => toggleShowOutlines(true)}>
                Show outlines
              </button>
              <button type="button" className={!showOutlines ? 'active' : ''} onClick={() => toggleShowOutlines(false)}>
                Hide until answered
              </button>
            </div>
            <span className="start-screen__hint">
              Tapping anywhere inside the right state always works either way — this just decides whether the map
              gives away where its border is before you guess.
            </span>
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

  function regionFillFor(region: MapRegion): string {
    if (feedback && region.id === feedback.countryId) {
      return feedback.correct ? 'var(--map-correct)' : 'var(--map-wrong)';
    }
    if (mode === 'typeIt' && current && region.id === current.id) {
      return 'var(--map-target)';
    }
    const prior = resultById.get(region.id);
    if (prior === true) return 'var(--map-answered)';
    if (prior === false) return 'var(--map-missed)';
    return 'var(--map-land)';
  }

  // See this component's own doc comment for the showOutlines/tappability split: an unanswered
  // state's outline is hidden when the toggle is off, but the moment it's been answered (this
  // question's own feedback, or any earlier one this session), its outline shows regardless —
  // same "the answer color reveals the shape" idea the fill above already relies on.
  function regionStrokeFor(region: MapRegion): string {
    if (showOutlines) return 'rgba(224, 164, 88, 0.55)';
    const answered = (feedback && region.id === feedback.countryId) || resultById.has(region.id);
    if (answered) return 'rgba(224, 164, 88, 0.75)';
    return 'transparent';
  }

  // Once a state's been answered (this question's own feedback flash, or any earlier one this
  // session), stamp its flag for the rest of the session — the state-quiz equivalent of
  // QuizScreen's flagFor, building "learn the flags" out of ordinary play instead of a dedicated
  // mode. Skipped for the 'flag' category specifically, same reason as there: the flag was
  // already the prompt for that question, so showing it again wouldn't teach anything.
  function regionImageFor(region: MapRegion): string | null {
    if (activeCategory === 'flag') return null;
    const alreadyAnswered = (feedback && region.id === feedback.countryId) || resultById.has(region.id);
    if (!alreadyAnswered) return null;
    const state = US_STATE_BY_ID[region.id];
    return state ? flagSrc(state) : null;
  }

  function handleRegionTap(region: MapRegion) {
    if (!current || mode !== 'findIt' || feedback) return;
    const answer: GenericAnswer = { type: 'findIt', clickedId: region.id };
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
        <div className="quiz-header__left">
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

      {/* Real land, flat neutral color — background context (this is where the state shapes
          sit) with no interactive country layer of its own (countryLayerInert). Opens already
          zoomed to the US via focusCountryId, instead of the whole globe. */}
      <WorldMap
        fillFor={() => 'var(--map-land)'}
        countryLayerInert
        regions={regions}
        regionFillFor={regionFillFor}
        regionStrokeFor={regionStrokeFor}
        regionImageFor={regionImageFor}
        onRegionTap={handleRegionTap}
        showCountryMarkers={false}
        focusCountryId={USA_COUNTRY_ID}
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

      {confirmingRestart && (
        <ConfirmDialog
          title="Restart this quiz?"
          message={
            session.results.length > 0
              ? `You've answered ${session.results.length} of ${totalInSession} so far — restarting throws that away and starts the same setup over from question 1.`
              : 'Start this setup over from question 1?'
          }
          confirmLabel="Restart"
          onConfirm={() => {
            setConfirmingRestart(false);
            quiz.playAgain();
          }}
          onCancel={() => setConfirmingRestart(false)}
        />
      )}
    </div>
  );
}
