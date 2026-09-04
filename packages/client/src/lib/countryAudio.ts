// Playback for the per-country name-pronunciation clips — a separate concern from sound.ts's
// quiz sound EFFECTS (correct/incorrect/finish cues): those are a handful of shared files, gated
// by the "sound on/off" toggle since they're ambient feedback the player might want to mute;
// these are 394 individual per-country clips (2 per country — see
// public/audio/countries/SOURCE.md) played only when the player deliberately taps a "listen"
// button, so they're never affected by that toggle — muting quiz dings shouldn't also silence a
// pronunciation the player explicitly asked to hear.
//
// Plain HTMLAudioElement rather than sound.ts's Web Audio API + decode-and-cache approach: there's
// no need for above-1.0 gain boosting here (no report these are too quiet), and eagerly decoding
// 394 files' worth of AudioBuffers on first use isn't worth it for something played one clip at a
// time, on demand. The browser's ordinary HTTP cache already avoids re-downloading a clip played
// twice in the same session.
//
// ONE reused element, not a fresh `new Audio()` per call — direct report from an iPad: the very
// first country's name announced itself fine, every one after that stayed silent (the OTHER quiz
// sounds kept working throughout, which points specifically at this file rather than at sound
// being blocked outright — those go through sound.ts's Web Audio API instead, a separately-gated
// mechanism). iOS Safari's autoplay permission for a `<audio>` element is tracked PER ELEMENT, not
// once for the whole page: a brand-new element starts locked again every time, and QuizScreen's
// automatic plays fire from a `setTimeout` (COUNTRY_AUDIO_AUTOPLAY_DELAY_MS) — not synchronously
// inside a user gesture — so Safari silently refuses each one's `.play()`. The very first
// question's clip apparently still lands (some leftover grace period right after the "Start quiz"
// tap), but nothing after that stood a chance. Reusing a single element and unlocking it with a
// real, synchronous play()/pause() round-trip inside actual gesture handlers (see
// unlockCountryAudio, called from QuizScreen's answer/skip handlers) keeps THAT element permitted
// for the rest of the session — changing its `src` and calling `.play()` again later, even from a
// timer, keeps working once an element has been through one genuine gesture-triggered play.
import { CountryDef } from '@worldly/engine';

export type AudioVariant = 'en' | 'native';

let sharedAudio: HTMLAudioElement | null = null;

// Set the instant unlockCountryAudio makes its one genuine attempt (see that function) — never
// reset, for the lifetime of the page. Guards against exactly what its own doc comment used to
// claim was "a harmless no-op": calling the mute/play/pause round-trip again on every later
// answer, even though the element was already unlocked, meant every single answer reached into
// whatever clip the shared element currently held — including, sometimes, the real pronunciation
// that had autoplayed for THIS question and might still be loading or mid-playback at that exact
// moment (a slow connection, or a tap landing while the ~1s clip is still going). Direct report:
// the target's name occasionally played a second time right after being answered, on top of every
// earlier fix for the pre-answer timer race (see QuizScreen's pendingAutoplayTimer) — because none
// of those touched this separate, unconditional call. There is nothing left for the round-trip to
// do after the first successful gesture-triggered play (iOS Safari's unlock is per-element, not
// per-call — see this module's doc comment), so skipping every later call removes the collision
// entirely rather than trying to further narrow its timing.
let unlocked = false;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

/** A country's name-pronunciation clip, bundled locally by `id` — see
 * public/audio/countries/SOURCE.md for provenance and how the id/variant → file mapping was
 * built. Same `id`-keyed convention as format.ts's countryFlagSrc. */
export function countryAudioSrc(country: CountryDef, variant: AudioVariant): string {
  return `${import.meta.env.BASE_URL}audio/countries/${country.id}_${variant}.mp3`;
}

/** Spends a genuine, currently-in-progress user gesture to keep the shared element unlocked for
 * iOS Safari's autoplay policy — call this SYNCHRONOUSLY from inside a real tap/click/submit
 * handler, before anything that might play a clip on this element later via a timer (see
 * QuizScreen's answer/skip handlers). Safe to call as often as you like — every call after the
 * first is now a real no-op (see `unlocked` above), not just an intended-to-be-harmless one: once
 * an element has been through one successful gesture-triggered play, it stays permitted for the
 * rest of the session, so there's nothing left for a second round-trip to accomplish, only real
 * clips left for it to collide with. Never throws and never needs to be awaited — same "purely
 * supplementary" stance as playCountryAudio below. */
export function unlockCountryAudio(): void {
  if (unlocked) return;
  // Set synchronously, before the actual play()/pause() round-trip below even starts (not in its
  // `restore` callback once that resolves) — otherwise a second answer landing before the first
  // round-trip's promise settles would fire a second overlapping attempt on top of it, the exact
  // collision this flag exists to prevent.
  unlocked = true;
  const audio = getSharedAudio();
  if (!audio) return;
  // Muted for this round-trip specifically — this element may already have a real clip loaded
  // (whatever last played), and without this a rapid string of answers would produce an audible
  // blip of that leftover clip on every tap, on top of the actual pronunciation that follows.
  const wasMuted = audio.muted;
  audio.muted = true;
  const restore = () => {
    audio.pause();
    audio.muted = wasMuted;
  };
  try {
    const result = audio.play();
    if (result && typeof result.then === 'function') {
      result.then(restore).catch(restore);
    } else {
      restore();
    }
  } catch {
    restore();
  }
}

/** Plays a country's name in the given variant. Fails silently (caught, never thrown) if the
 * clip is missing or the browser blocks playback — this is purely supplementary, never worth
 * surfacing an error over. Reuses the same shared element every call (see the module doc comment
 * above for why that matters specifically for iOS Safari's per-element autoplay lock), so a clip
 * already playing when a new one starts is simply replaced by it, same as switching tracks on any
 * single audio player. */
export function playCountryAudio(country: CountryDef, variant: AudioVariant): void {
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    audio.src = countryAudioSrc(country, variant);
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Playback itself failing (unsupported environment, etc.) — nothing to do.
  }
}
