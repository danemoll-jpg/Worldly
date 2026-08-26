# US state flag source

All 50 SVGs in this folder were fetched from Wikimedia Commons (`Special:FilePath/Flag_of_<State>.svg`)
on 2026-08-26. US state flags are almost universally public domain (government works) or released
under a free license by their Commons uploader/vectorizer — see the individual file's page on
Wikimedia Commons (`https://commons.wikimedia.org/wiki/File:Flag_of_<State>.svg`) for that specific
file's license and attribution if it's ever redistributed outside this app.

Filenames are the state's USPS two-letter postal code, lowercased (`ca.svg`, `ny.svg`, ...) — see
`usStates.ts` in `@worldly/engine` for the id/name join.
