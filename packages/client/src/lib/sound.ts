// Sound-effect playback for the quiz — a small, self-contained module so every quiz screen can
// fire the same handful of cues (answer feedback, quiz completion) without duplicating audio-
// element bookkeeping or the "is sound turned on" check three times over. Built on the plain
// Audio API directly rather than a library — five short one-shot clips don't need anything
// heavier.
//
// The actual audio FILES aren't part of this codebase — see public/sounds/SOURCE.md for the
// exact filenames this expects and the text prompts used to generate them externally (ElevenLabs
// Studio). Playback fails silently (caught, never thrown) if a file is missing or a browser's
// autoplay policy blocks it, so the app works fine whether or not the real sounds are in place
// yet — a missing sound is exactly as silent as a muted one.

export type SoundName = 'correct' | 'incorrect' | 'quizFinish' | 'quizFinishPerfect' | 'quizFinishRecord';

const SOUND_FILES: Record<SoundName, string> = {
  correct: 'correct.mp3',
  incorrect: 'incorrect.mp3',
  quizFinish: 'quiz-finish.mp3',
  quizFinishPerfect: 'quiz-finish-perfect.mp3',
  quizFinishRecord: 'quiz-finish-record.mp3',
};

const SOUND_ENABLED_KEY = 'worldlySoundEnabled';

export function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_ENABLED_KEY);
    return raw === null ? true : raw === 'true'; // on by default
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // ignore — just a preference, no worse than not remembering it
  }
}

// One cached Audio element per cue rather than constructing a fresh one on every play — the
// browser fetches each clip once and reuses it, so a rapid string of correct answers doesn't
// pile up redundant network requests.
const audioCache = new Map<SoundName, HTMLAudioElement>();

function audioFor(name: SoundName): HTMLAudioElement {
  let audio = audioCache.get(name);
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}sounds/${SOUND_FILES[name]}`);
    audio.volume = 0.55; // audible but not competing with anything else the player might have on
    audioCache.set(name, audio);
  }
  return audio;
}

/** Plays a cue if sound is turned on. Safe to call even when the underlying file doesn't exist
 * yet, or when the browser's autoplay policy blocks it (play() rejects instead of throwing, and
 * that rejection is swallowed here — this is purely decorative, never worth surfacing an error
 * over). */
export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;
  const audio = audioFor(name);
  // Restart from the beginning even if this exact cue is still finishing from a moment ago (two
  // correct answers in quick succession, say) — otherwise a second play() on an already-playing
  // element is a silent no-op instead of retriggering it.
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay-blocked or the file's missing — nothing to do about it here.
  });
}

/** Which of the three "quiz finished" cues fits a just-completed session — a new personal best
 * outranks a merely-perfect score (it's the rarer, more specifically earned achievement: beating
 * your OWN history at this exact setup, which a 100% run doesn't guarantee on its own if a past
 * run was somehow both faster and also 100%), which outranks the plain completion cue everything
 * else gets. */
export function completionSound(percentCorrect: number, isNewBest: boolean): SoundName {
  if (isNewBest) return 'quizFinishRecord';
  if (percentCorrect === 100) return 'quizFinishPerfect';
  return 'quizFinish';
}
