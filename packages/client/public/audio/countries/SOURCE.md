# Country name pronunciation audio

Two clips per quizzable country (394 files total, all 197):

- `{id}_en.mp3` — the country's name spoken in English.
- `{id}_native.mp3` — the country's name spoken in (an approximation of) its own official
  language's pronunciation, via a locale-appropriate TTS voice (e.g. `fr-FR` for France,
  `ar-XA` for Egypt). For countries where English already is the/an official language, this is
  effectively the same reading as the `_en` clip.

Generated 2026-08-30 by a one-off TTS project (`country-tts/`, sibling to this repo, not itself
part of it) using Google Cloud Text-to-Speech, keyed by ISO 3166-1 alpha-2 code. `id` here is
this app's own `CountryDef.id` (ISO 3166-1 numeric, or the synthetic `kosovo` slug) — same
join-by-name-then-rename approach as `public/data/flags/countries/SOURCE.md` uses for the flag
SVGs, so the client can look a clip up directly from `CountryDef.id` without a second table at
runtime. See `packages/client/src/lib/countryAudio.ts` for playback.

Regenerating: the source project's `manifest.json` (one entry per country: alpha-2 `code`,
`name`, `englishFile`, `nativeFile`, `nativeLocale`) is the join key — match its `name` against
this app's `countries.ts` `name` (exact string match, all 197 lined up cleanly as of generation
time) to recover each entry's `id`, then copy/rename `{code}_en.mp3` → `{id}_en.mp3` and
`{code}_native.mp3` → `{id}_native.mp3`.
