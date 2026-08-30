// Sound-effect playback for the quiz — a small, self-contained module so every quiz screen can
// fire the same handful of cues (answer feedback, quiz completion) without duplicating audio
// bookkeeping or the "is sound turned on" check three times over.
//
// Built on the Web Audio API (AudioContext + GainNode) rather than the simpler <audio>/Audio
// element this used originally — that's not a stylistic choice, it's the actual fix for a real
// report ("[the incorrect sound] I can't even hear it… unless it is possible for you to make it
// louder"): HTMLMediaElement.volume tops out at 1.0, which is only ever "as loud as the clip's
// own recorded level," never louder. A GainNode has no such ceiling — its gain can exceed 1.0 for
// genuine amplification past what the source recording itself provides, which is the only way to
// actually answer "can you make it louder" for a clip that's just naturally quiet. See
// SOUND_GAIN below for where that's applied.
//
// The actual audio FILES aren't part of this codebase — see public/sounds/SOURCE.md for the
// exact filenames this expects and the text prompts used to generate them externally (ElevenLabs
// Studio). Playback fails silently (caught, never thrown) if a file is missing, fails to decode,
// or a browser's autoplay policy blocks it, so the app works fine whether or not the real sounds
// are in place yet — a missing sound is exactly as silent as a muted one.

export type SoundName = 'quizStart' | 'correct' | 'incorrect' | 'quizFinish' | 'quizFinishPerfect' | 'quizFinishRecord';

const SOUND_FILES: Record<SoundName, string> = {
  quizStart: 'quiz-start.mp3',
  correct: 'correct.mp3',
  incorrect: 'incorrect.mp3',
  quizFinish: 'quiz-finish.mp3',
  quizFinishPerfect: 'quiz-finish-perfect.mp3',
  quizFinishRecord: 'quiz-finish-record.mp3',
};

/** Shared baseline gain every cue starts from (a modest bump over the old flat 0.55 volume,
 * independent of the per-cue boost below). */
const BASE_GAIN = 0.7;

/** Per-cue multiplier on top of BASE_GAIN — a way to make ONE cue louder than the others without
 * needing to re-normalize/re-generate every file. 'incorrect' needed a real boost after direct
 * user feedback that it was essentially inaudible; the other four weren't reported as a problem,
 * so they stay at the shared baseline. If a boosted cue ever sounds distorted/clipped rather than
 * just louder, that means its own recorded peaks are too close to full scale for this much extra
 * gain to stay clean — dial the number down rather than assuming the whole approach is broken. */
const SOUND_GAIN: Record<SoundName, number> = {
  quizStart: 1,
  correct: 1,
  incorrect: 2.5,
  quizFinish: 1,
  quizFinishPerfect: 1,
  quizFinishRecord: 1,
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

// One shared AudioContext, created lazily (constructing one before any user gesture is itself
// enough to log a browser warning in some cases) and reused for every cue.
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

// One decode-in-flight (then decoded-forever) promise per cue, keyed so a rapid string of
// answers before the first decode finishes all await the SAME fetch+decode instead of racing
// duplicate requests. A rejected/failed promise (missing file, bad data) resolves to null rather
// than staying rejected, so a bad cue doesn't turn into an unhandled rejection later.
const bufferCache = new Map<SoundName, Promise<AudioBuffer | null>>();

function bufferFor(name: SoundName, ctx: AudioContext): Promise<AudioBuffer | null> {
  let promise = bufferCache.get(name);
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}sounds/${SOUND_FILES[name]}`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`missing sound file: ${name}`))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    bufferCache.set(name, promise);
  }
  return promise;
}

/** Plays a cue if sound is turned on. Safe to call even when the underlying file doesn't exist
 * yet, fails to decode, or the browser's autoplay policy has the AudioContext suspended (resumed
 * here — every call already happens IN RESPONSE to a user gesture, a tap/click, so this resolves
 * essentially instantly in practice) — none of that is worth surfacing an error over, this is
 * purely decorative. */
export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  bufferFor(name, ctx)
    .then((buffer) => {
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = BASE_GAIN * (SOUND_GAIN[name] ?? 1);
      source.connect(gain).connect(ctx.destination);
      source.start(0);
    })
    .catch(() => {
      // Decode succeeded but playback itself failed for some other reason — still nothing to do.
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
