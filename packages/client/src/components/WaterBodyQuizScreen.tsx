import { useEffect, useMemo, useRef, useState } from 'react';
import { GenericAnswer, masteryLevel, QuizAnswerResult, StatsMap, WaterBodyDef, WATER_BODIES, WATER_BODY_BY_ID } from '@worldly/engine';
import { getWaterBodyRegions, MapRegion } from '../lib/geo';
import { GenericQuizController } from '../hooks/useGenericQuiz';
import { isBetterSession } from '../lib/storage';
import { ConfirmDialog } from './ConfirmDialog';
import { WorldMap } from './WorldMap';

interface WaterBodyQuizScreenProps {
  quiz: GenericQuizController<WaterBodyDef>;
  stats: StatsMap;
  onViewRecords: () => void;
  /** Quitting mid-quiz or finishing — goes all the way home, same as the country quiz's own
   * quit/home buttons. */
  onBack: () => void;
  /** The setup screen's own "‹ Back" button, before a session has started — goes back one level,
   * to the quiz-type picker, not all the way home (see QuizPickerScreen). */
  onBackToPicker: () => void;
}

const FEEDBACK_DISPLAY_MS = 1200;
const SHOW_OUTLINES_KEY = 'worldlyWaterBodiesShowOutlines';

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

/** "Find the ocean/sea on the map, or type its name" — the water equivalent of the country
 * quiz, built on the shared genericSession/useGenericQuiz machinery instead of session.ts's
 * (country-specific) one. Every body is a real, directly-tappable region shape
 * (`getWaterBodyRegions` — see MapRegion's doc comment in geo.ts and
 * water-body-regions.json.SOURCE.md for how a genuinely non-overlapping named tessellation of
 * the ocean turned up, resolving the nesting/fuzzy-boundary problem that originally ruled real
 * borders out); the old marker-dot fallback is gone now that nothing needs it. `showOutlines`
 * (a player-chosen toggle, persisted) only affects whether a region's OUTLINE is visible before
 * it's been answered — tapping anywhere inside a body's real shape always works regardless, so
 * turning outlines off just means the map doesn't visually spoil where each body's boundary is
 * ahead of time; a region's fill still turns green/red/gold on interaction either way, which
 * naturally reveals its outline through contrast at that point.
 *
 * Land renders in a flat, deliberately non-blue gray and never registers a tap (`fillFor`/
 * `countryLayerInert` below) — the whole background is otherwise a clear, saturated blue (see
 * `world-map-wrap--water-quiz` in index.css and `--map-water`), so "gray = land, blue = water,
 * tap the water" reads at a glance instead of land and sea sharing the same blue-gray this app
 * uses everywhere else land is the thing being quizzed.
 *
 * Self-contained (setup → play → summary in one screen) rather than reusing SetupScreen/
 * QuizScreen/SummaryScreen — those were built around the country quiz's much larger config
 * surface (category, continents, multiple-choice difficulty); this quiz's surface is just mode +
 * scope + show-outlines.
 *
 * `quiz`/`stats` come from useQuiz.ts, which owns persistence/sync for this universe — this
 * component is purely presentational over that controller, same relationship QuizScreen has to
 * useQuiz's country-quiz state. */
export function WaterBodyQuizScreen({ quiz, stats, onViewRecords, onBack, onBackToPicker }: WaterBodyQuizScreenProps) {
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [regions, setRegions] = useState<MapRegion[]>([]);
  const [showOutlines, setShowOutlines] = useState<boolean>(loadShowOutlines);
  const [pendingMode, setPendingMode] = useState<'findIt' | 'typeIt'>('findIt');
  const [pendingScope, setPendingScope] = useState<'all' | 'weakSpots'>('all');
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const seenResultCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getWaterBodyRegions().then((loaded) => {
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
          <button type="button" className="back-link" onClick={onBackToPicker}>
            ‹ Back
          </button>
          <h1>🌊 Seas & oceans</h1>
          <p className="start-screen__subtitle">
            Find the 5 oceans and {WATER_BODIES.length - 5} major seas — real boundaries on the map, tap anywhere
            inside one.
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
              Tapping anywhere inside the right body always works either way — this just decides whether the map
              gives away where its boundary is before you guess.
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
    // Unanswered and not the typeIt target — same blue as the open water around it (see
    // --map-water), so an untouched body doesn't visually stand out from ordinary open ocean.
    return 'var(--map-water)';
  }

  // See this component's own doc comment for the showOutlines/tappability split: an unanswered
  // region's outline is hidden (blends into the surrounding water) when the toggle is off, but
  // the moment it's been answered (this question's own feedback, or any earlier one this
  // session), its outline shows regardless — same "the answer color reveals the shape" idea as
  // the fill above.
  function regionStrokeFor(region: MapRegion): string {
    if (showOutlines) return 'rgba(224, 164, 88, 0.55)';
    const answered = (feedback && region.id === feedback.countryId) || resultById.has(region.id);
    if (answered) return 'rgba(224, 164, 88, 0.75)';
    return 'transparent';
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

      {/* Land renders flat and gray (--map-land-inert) and never takes a tap
          (countryLayerInert) — the whole point of this screen is the water, which is a clear,
          saturated blue everywhere (world-map-wrap--water-quiz's background) whether or not it's
          inside one of the 20 named regions drawn on top. */}
      <WorldMap
        className="world-map-wrap--water-quiz"
        fillFor={() => 'var(--map-land-inert)'}
        countryLayerInert
        regions={regions}
        regionFillFor={regionFillFor}
        regionStrokeFor={regionStrokeFor}
        onRegionTap={handleRegionTap}
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
