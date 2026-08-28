import { useEffect, useMemo, useRef, useState } from 'react';
import { Answer, Continent, CONTINENTS, CountryDef, COUNTRY_BY_ID, QuizAnswerResult, QuizSessionState } from '@worldly/engine';
import { ConfirmDialog } from './ConfirmDialog';
import { countryFlagSrc, promptFor } from '../lib/format';
import { getContinentBounds, MapFeature } from '../lib/geo';
import { pickChoices } from '../lib/multipleChoice';
import { playSound } from '../lib/sound';
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
  // Captured at the moment a multiple-choice button is picked, not derived live from
  // `session.current` — by the time feedback for THIS answer is visible, `submitAnswer` has
  // already advanced `current` to the NEXT question (same state update, see the effect below),
  // so deriving "which button was right" from the live current/choices would show the WRONG
  // question's answer highlighted during the very feedback flash that's naming a different one.
  // Freezing exactly what was on screen at pick-time sidesteps that race entirely.
  const [answeredChoice, setAnsweredChoice] = useState<{ options: CountryDef[]; correctId: string; pickedId: string } | null>(null);
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
      playSound(result.correct ? 'correct' : 'incorrect');
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
  const { mode, category, multipleChoiceDifficulty, continents } = session.config;

  // Auto-zoom to whichever continent(s) are actually being quizzed — same idea as
  // UsStatesQuizScreen's focusCountryId, just region-shaped instead of a single country. 'all'
  // continents stays at the default whole-world view (null focusBounds is a no-op for WorldMap,
  // same as focusCountryId={null}). Computed here rather than inline in the WorldMap prop below
  // since getContinentBounds is async (map data loads once, then is cached).
  const [continentFocusBounds, setContinentFocusBounds] = useState<[number, number, number, number] | null>(null);
  const continentsKey = continents === 'all' ? 'all' : continents.join(',');
  useEffect(() => {
    if (continents === 'all') {
      setContinentFocusBounds(null);
      return;
    }
    let cancelled = false;
    getContinentBounds(continents).then((bounds) => {
      if (!cancelled) setContinentFocusBounds(bounds);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continentsKey]);
  const prompt = current ? promptFor(category, current.country) : null;
  // Recomputed only when the question actually changes, not on every render (e.g. the feedback
  // flash) — otherwise the 4 buttons would visibly reshuffle themselves right after answering.
  const choices = useMemo(
    () => (current && mode === 'multipleChoice' ? pickChoices(current.country, session.pool, multipleChoiceDifficulty) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.country.id, mode, multipleChoiceDifficulty],
  );
  // Safe to show WHERE the target is exactly when its identity isn't the thing being guessed:
  // findIt's whole mechanic IS finding it on the map, so that stays hidden regardless of
  // category; category 'flag'/'capital' hide it too, since seeing the location would just hand
  // over the country's identity for free. continent mode always qualifies regardless of
  // category — it already shows the plain country name no matter what `category` happens to be
  // set to (see promptLead), and seeing the shape/location is a legitimate, intended way to
  // help place its continent, not an accidental leak.
  const revealsLocationOnMap = mode === 'continent' || (mode !== 'findIt' && category === 'country');

  function fillFor(feature: MapFeature): string {
    if (!feature.quizzable) return 'var(--map-bg)';
    if (feedback && feature.id === feedback.result.countryId) {
      return feedback.result.correct ? 'var(--map-correct)' : 'var(--map-wrong)';
    }
    if (revealsLocationOnMap && current && feature.id === current.country.id) {
      return 'var(--map-target)';
    }
    const priorResult = resultByCountry.get(feature.id);
    if (priorResult === true) return 'var(--map-answered)';
    if (priorResult === false) return 'var(--map-missed)';
    return 'var(--map-land)';
  }

  // Once a country's been answered (this question's own feedback flash, or any earlier one this
  // session — same "already answered" set fillFor's --map-answered/--map-missed tint uses), stamp
  // its flag at its location for the rest of the session. Turns ordinary play into incidental
  // flag-learning: by the end of a full-world quiz the whole map is labeled with flags you've
  // now seen paired with their shapes, not just a one-second flash. Skipped for the 'flag'
  // category specifically — the flag was already the prompt for that question, so showing it
  // again on the map wouldn't teach anything new.
  function flagFor(feature: MapFeature): string | null {
    if (category === 'flag' || !feature.quizzable) return null;
    const alreadyAnswered = (feedback && feature.id === feedback.result.countryId) || resultByCountry.has(feature.id);
    if (!alreadyAnswered) return null;
    const country = COUNTRY_BY_ID[feature.id];
    return country ? countryFlagSrc(country) : null;
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

  function handleChoicePick(countryId: string) {
    if (!current || feedback) return;
    setAnsweredChoice({ options: choices, correctId: current.country.id, pickedId: countryId });
    onAnswer({ type: 'findIt', clickedCountryId: countryId });
  }

  const canSkip = !!current && !feedback && session.remaining.length > 1;
  // Continent mode is already a 6-way multiple choice — a hint would barely make it easier, so
  // it's only offered for findIt/typeIt/multipleChoice, where a "just guessing" moment is a
  // real possibility.
  const canHint = mode !== 'continent' && !!current && !feedback;
  // findIt + 'country' is the one combination where the country's own name is already sitting
  // right there in the prompt text ("Find: France") — "starts with F" would just be reading
  // back a letter that's already on screen. The continent clue stays useful even then, since
  // findIt's actual challenge is spatial (where to tap), not remembering the name.
  const nameAlreadyShown = mode === 'findIt' && category === 'country';

  function promptLead(): React.ReactNode {
    if (mode === 'continent') {
      return (
        <span>
          Which continent is <strong>{current!.country.name}</strong> in?
        </span>
      );
    }
    if (!prompt) return null;

    // multipleChoice's 'country' category is a special case: the button options are already
    // country NAMES, so a "Find: France" text prompt would just be handing the answer straight
    // back — no different from labeling a multiple-choice question with its own correct answer.
    // It has to use typeIt's approach instead (the map silently highlights the target, no name
    // said out loud anywhere) for the buttons to mean anything. flag/capital categories don't
    // have this problem — the prompt there is never the same representation as the options — so
    // multipleChoice can share findIt's wording for those exactly as before.
    if (mode === 'findIt' || (mode === 'multipleChoice' && category !== 'country')) {
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
          {prompt.kind === 'flag' ? <img className="quiz-prompt__flag" src={prompt.content} alt="" /> : <strong>{prompt.content}</strong>}
        </span>
      );
    }

    // typeIt (any category) and multipleChoice + 'country' both rely on the map's own
    // highlight to say which country is being asked about, never a text name.
    if (category === 'country') return <span>What country is highlighted?</span>;
    const question = category === 'flag' ? 'Whose flag is this?' : 'Which country has this capital?';
    return (
      <span>
        {question} {prompt.kind === 'flag' ? <img className="quiz-prompt__flag" src={prompt.content} alt="" /> : <strong>{prompt.content}</strong>}
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
                  🤔 {current.country.continent}
                  {!nameAlreadyShown && ` · starts with "${current.country.name[0]}"`}
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

      <WorldMap
        fillFor={fillFor}
        flagFor={flagFor}
        onCountryTap={handleMapTap}
        // A continent filter's own wide-but-still-comfortable focusBounds view (below) already
        // keeps every country in play visible and legible — re-focusing tightly on just the
        // current one every question (this mode's ordinary behavior with no filter active) would
        // fight it, snapping back and forth between two different zoom levels each question
        // instead of staying settled on the continent(s) actually being quizzed.
        focusCountryId={revealsLocationOnMap && continents === 'all' ? (current?.country.id ?? null) : null}
        focusBounds={continentFocusBounds}
      />

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
        <div className="quiz-choice-grid">
          {CONTINENTS.map((c) => (
            <button key={c} type="button" disabled={!!feedback} onClick={() => handleContinentPick(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {mode === 'multipleChoice' && current && (
        <div className="quiz-choice-grid">
          {/* While feedback for the just-answered question is showing, render ITS frozen
              options/correct-id (answeredChoice) instead of the live `choices`/`current` for
              the question that's already been advanced to underneath — see answeredChoice's
              declaration for why. */}
          {(feedback && answeredChoice ? answeredChoice.options : choices).map((country) => {
            const correctId = feedback && answeredChoice ? answeredChoice.correctId : current.country.id;
            const isCorrectAnswer = !!feedback && country.id === correctId;
            const isWrongPick = !!feedback && !!answeredChoice && country.id === answeredChoice.pickedId && !feedback.result.correct;
            const className = isCorrectAnswer ? 'quiz-choice--correct' : isWrongPick ? 'quiz-choice--wrong' : '';
            return (
              <button key={country.id} type="button" className={className} disabled={!!feedback} onClick={() => handleChoicePick(country.id)}>
                {country.name}
              </button>
            );
          })}
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
