# Country flag source

All 197 SVGs in this folder are the `4x3` (rectangular) flags from the
[`flag-icons`](https://github.com/lipis/flag-icons) npm package (MIT license, © Panayiotis
Lipiridis), copied on 2026-08-26. That package ships one SVG per ISO 3166-1 alpha-2 code; the
mapping from this app's country `id` (ISO 3166-1 numeric, or a synthetic slug for the handful of
entries with none — see `countries.ts` in `@worldly/engine`) to the alpha-2 code used to pick the
source file was resolved via the `world-countries` npm package's `ccn3` field, with one manual
override:

- `kosovo` (no ISO numeric code) → `xk`

Both `world-countries` and `flag-icons` were one-time dev-time data sources, not runtime
dependencies — they're already uninstalled. Regenerate by reinstalling them temporarily (see git
history for `gen-country-flags.js`-style scripts) if this ever needs refreshing, e.g. after a
`flag-icons` update or if a new country is added to the quiz.

Filenames are the country's `id` from `countries.ts` (`840.svg` for the United States, `kosovo.svg`
for Kosovo, etc.) — not the ISO alpha-2 code — so the client can look one up directly from
`CountryDef.id` without carrying a second join table at runtime.
