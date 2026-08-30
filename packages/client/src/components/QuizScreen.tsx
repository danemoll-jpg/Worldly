import { useEffect, useMemo, useRef, useState } from 'react';
import { Answer, Continent, CONTINENTS, CountryDef, COUNTRY_BY_ID, QuizAnswerResult, QuizSessionState } from '@worldly/engine';
import { ConfirmDialog } from './ConfirmDialog';
import { playCountryAudio, unlockCountryAudio } from '../lib/countryAudio';
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
  /** "Actually, that was right" — see the button that calls this, below. Corrects only the
   * answer just given; the engine enforces that (overrideLastResultAsCorrect), so passing this
   * straight through needs no guarding here. */
  onOverrideLastAnswer: () => void;
}

interface Feedback {
  result: QuizAnswerResult;
}

const FEEDBACK_DISPLAY_MS = 1200;
/** A wrong answer's feedback stays up longer than a correct one's — not for its own sake, but to
 * leave a real window to notice and use the "Actually, that was right" override below before it
 * fades. Added after a direct report of a tap that visibly landed on the right country still
 * getting marked wrong (a real bug, since fixed — see geo.ts's inset tap-radius fix — but a
 * manual escape hatch is worth keeping regardless, for whatever imprecision or ambiguity turns
 * up next). */
const WRONG_FEEDBACK_DISPLAY_MS = 4000;

/** Autoplaying a country's name (both effects below) waits this long first — direct report that
 * the name was audibly starting before a just-triggered sound effect had finished (the quizStart
 * chime on question 1, or the correct/incorrect cue every other question), talking over it rather
 * than following it. Neither of those cues is much over a second (see
 * public/sounds/SOURCE.md — quizStart is "under 1.5 seconds", correct/incorrect "under 1
 * second"), so this only needs to be a beat, not a real pause. */
const COUNTRY_AUDIO_AUTOPLAY_DELAY_MS = 900;

export function QuizScreen({ session, onAnswer, onSkip, onQuit, onRestart, onOverrideLastAnswer }: QuizScreenProps) {
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

  // A new result landed (either mode) — flash brief correct/wrong feedback. Auto-clearing that
  // feedback is a SEPARATE effect below, keyed on `feedback` itself rather than on
  // `session.results` — see that effect's comment for why the two can't be combined.
  useEffect(() => {
    if (session.results.length > seenResultCount.current) {
      const result = session.results[session.results.length - 1];
      seenResultCount.current = session.results.length;
      setFeedback({ result });
      setTypedAnswer('');
      playSound(result.correct ? 'correct' : 'incorrect');
    } else {
      seenResultCount.current = session.results.length;
    }
  }, [session.results]);

  // Auto-clears whatever feedback is currently showing, re-armed any time `feedback` itself
  // changes. This has to be its own effect, separate from the one above: that one is keyed on
  // `session.results`, and `handleOverrideLastAnswer` below calls `onOverrideLastAnswer`, which
  // replaces the session object WITHOUT growing `results` — so if the clear-timer lived in the
  // results effect, the override would re-run that effect (canceling its pending timer via
  // cleanup) but hit the "nothing new" branch, which never reschedules one. That left `feedback`
  // stuck forever, which silently blocked all further taps (handleMapTap below no-ops while
  // feedback is showing) — a real bug this split fixes, found by playing an actual session end
  // to end rather than trusting a single override click in isolation.
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), feedback.result.correct ? FEEDBACK_DISPLAY_MS : WRONG_FEEDBACK_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  // "Actually, that was right" — corrects the answer just given (both the persisted session
  // data, via onOverrideLastAnswer, AND this component's own transient feedback flash, which
  // isn't derived from the session and wouldn't otherwise update to match). The map's own
  // colors (fillFor below, keyed off session.results through resultByCountry) update on their
  // own once the session data changes — no separate patch needed there.
  function handleOverrideLastAnswer() {
    onOverrideLastAnswer();
    setFeedback((prev) => (prev ? { result: { ...prev.result, correct: true } } : prev));
    playSound('correct');
  }

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

  // Every answer-submitting handler below spends its real, synchronous tap/click/submit gesture
  // to keep the shared country-audio element unlocked (see countryAudio.ts's unlockCountryAudio)
  // — both autoplay effects further down play a clip from a `setTimeout`, well after this gesture
  // has ended, which iOS Safari won't otherwise treat as user-initiated.
  function handleMapTap(feature: MapFeature) {
    if (!current || mode !== 'findIt' || !feature.quizzable || feedback) return;
    unlockCountryAudio();
    onAnswer({ type: 'findIt', clickedCountryId: feature.id });
  }

  function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || feedback || !typedAnswer.trim()) return;
    unlockCountryAudio();
    onAnswer({ type: 'typeIt', submittedAnswer: typedAnswer });
  }

  function handleContinentPick(continent: Continent) {
    if (!current || feedback) return;
    unlockCountryAudio();
    onAnswer({ type: 'continent', selectedContinent: continent });
  }

  function handleChoicePick(countryId: string) {
    if (!current || feedback) return;
    unlockCountryAudio();
    setAnsweredChoice({ options: choices, correctId: current.country.id, pickedId: countryId });
    onAnswer({ type: 'findIt', clickedCountryId: countryId });
  }

  function handleSkip() {
    unlockCountryAudio();
    onSkip();
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
  // Same leak concern as the hint above, but stricter: hearing the country's name pronounced IS
  // the answer for every category/mode combination except the ones where the name's already
  // sitting in the prompt as text (nameAlreadyShown) or continent mode (which always names the
  // country up front — see promptLead — since the thing being guessed there is its continent,
  // not its identity). Every other combination offers a listen button only once feedback reveals
  // the answer (see the feedback branch in the JSX below), never before.
  const canListenBeforeAnswer = !!current && !feedback && (nameAlreadyShown || mode === 'continent');
  // True for exactly one transitional render right after answering: `session.current` (a prop)
  // has already advanced to the NEXT question, but the results effect above hasn't yet run this
  // commit to call setFeedback for the answer just given — so local `feedback` state still reads
  // null, same as it would for an ordinary "no feedback pending" render. Without this check, the
  // pre-answer autoplay effect right below can't tell the two apart and fires for the wrong
  // (about-to-be-hidden-behind-feedback) question — confirmed by hand: answering Turkey wrong
  // played Paraguay's clip (the next question underneath) instead of replaying Turkey's. Reading
  // `seenResultCount.current` here, during RENDER, is safe specifically because refs only change
  // when an effect mutates them (post-render) — so on this transitional render it still holds last
  // commit's value, correctly flagging "there's a result no effect has processed yet."
  const hasUnprocessedResult = session.results.length > seenResultCount.current;

  // Autoplay the target's English pronunciation the instant its name becomes safely visible as
  // plain text — the same set of cases the pre-answer "Hear it" button covers (canListenBeforeAnswer
  // above), so hearing it said is the default experience now, with the button there only to
  // replay it. Re-evaluated whenever the question changes OR feedback stops covering it — a fresh
  // question, a skip, a restart, or the feedback overlay for the PREVIOUS question clearing to
  // reveal this one underneath — but not on every unrelated re-render (hint reveals, typed input,
  // ...), since `feedback` is a stable `null` reference across those.
  useEffect(() => {
    if (feedback || hasUnprocessedResult || !current || !canListenBeforeAnswer) return;
    const country = current.country;
    const timer = setTimeout(() => playCountryAudio(country, 'en'), COUNTRY_AUDIO_AUTOPLAY_DELAY_MS);
    // Cancels a still-pending delayed play if the question changes (or the effect otherwise
    // re-runs) before it fires — e.g. skipping within the delay window shouldn't leave the SKIPPED
    // country's name queued up to speak over the next one.
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.country.id, feedback, hasUnprocessedResult]);

  // Deliberately NOT autoplaying the just-answered country's name when feedback reveals it — it
  // already played up front (the effect above, wherever that applies) or is one tap away via the
  // "Hear it" button in the feedback branch below; repeating it automatically on every single
  // answer got noisy fast. Direct feedback: only say it again when the player actually asks.

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
          <>
            <span className={feedback.result.correct ? 'quiz-prompt__feedback quiz-prompt__feedback--correct' : 'quiz-prompt__feedback quiz-prompt__feedback--wrong'}>
              {feedback.result.correct ? '✅ Correct!' : `❌ That was ${COUNTRY_BY_ID[feedback.result.countryId]?.name}`}
            </span>
            {COUNTRY_BY_ID[feedback.result.countryId] && (
              <button
                type="button"
                className="listen-btn"
                onClick={() => playCountryAudio(COUNTRY_BY_ID[feedback.result.countryId]!, 'en')}
              >
                🔊 Hear it
              </button>
            )}
            {!feedback.result.correct && (
              <button type="button" className="quiz-override-correct" onClick={handleOverrideLastAnswer}>
                Actually, that was right ✓
              </button>
            )}
          </>
        ) : current ? (
          <>
            {promptLead()}
            {canListenBeforeAnswer && (
              <button type="button" className="listen-btn" onClick={() => playCountryAudio(current.country, 'en')}>
                🔊 Hear it
              </button>
            )}
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
            <button type="button" className="quiz-skip" onClick={handleSkip} disabled={!canSkip} title="Come back to this one later in the session">
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
