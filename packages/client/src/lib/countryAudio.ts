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

import { CountryDef } from '@worldly/engine';

export type AudioVariant = 'en' | 'native';

/** A country's name-pronunciation clip, bundled locally by `id` — see
 * public/audio/countries/SOURCE.md for provenance and how the id/variant → file mapping was
 * built. Same `id`-keyed convention as format.ts's countryFlagSrc. */
export function countryAudioSrc(country: CountryDef, variant: AudioVariant): string {
  return `${import.meta.env.BASE_URL}audio/countries/${country.id}_${variant}.mp3`;
}

/** Plays a country's name in the given variant. Fails silently (caught, never thrown) if the
 * clip is missing or the browser blocks playback — exactly like playSound, this is purely
 * supplementary and never worth surfacing an error over. Every call already happens in response
 * to a user tap, so autoplay restrictions aren't a practical concern. */
export function playCountryAudio(country: CountryDef, variant: AudioVariant): void {
  try {
    const audio = new Audio(countryAudioSrc(country, variant));
    audio.play().catch(() => {});
  } catch {
    // Audio construction itself failing (unsupported environment, etc.) — nothing to do.
  }
}
