# Backlog

Ideas and recommendations we've discussed and agreed to hold off on, so they don't depend on
conversation memory to survive — a session boundary or a context compaction doesn't carry
anything forward that isn't written down somewhere durable like this file. If we discuss a
feature and decide to come back to it later, it goes here before that conversation ends.

Each item should carry enough context to pick up cold: what it is, why it came up, and any
relevant decisions already made. When something ships, move it to "Done" with the date and a
commit pointer instead of deleting it — keeps a real record of what was deferred-then-built vs.
just forgotten.

## Open

- **Daily Challenge streak doesn't sync across devices — unlike the rest of the app.** Confirmed
  in code (8/25/2026): `useDailyChallenge.ts` reads/writes only `localStorage` directly
  (`worldlyDailyChallenge` key) — it never touches the sync pipeline (`network/sync.ts`) that
  personal bests and weak-spots history go through. So if you play the daily challenge on one
  device, that streak lives only there; open the app on another device (even one connected to the
  same sync code) and it's tracking a completely separate streak. Surfaced by the user right after
  the "clear my stats & history" reset feature shipped — a natural expectation once cross-device
  sync exists at all is that "one shared question a day" also means one shared streak. Fix would
  mean folding the daily-challenge state (`lastPlayedDateKey`/`lastPlayedCorrect`/`streak`) into
  the same synced document `history`/`stats` already use, same idea as the reset feature's
  `resetSyncDoc` — not started, not scoped beyond this.

## Done

- **Seas and oceans quiz — shipped.** Find/name bodies of water (5 oceans + 15 major seas), the
  water equivalent of the country quiz. The open question flagged here — seas nest inside oceans
  and have fuzzy, conventional boundaries, so the exact `WorldMap` country-tap model might not
  port over — was resolved with the user rather than guessed: each body is a hand-picked
  open-water marker point (reusing the tiny-country marker/adaptive-tap-radius machinery already
  in `geo.ts`), not a claimed real boundary polygon, which sidesteps the nesting problem entirely
  since points don't overlap the way polygons would. New shared engine infra
  (`genericSession.ts`) generic over any `{id, name, aliases?}` item, reused by the US-states quiz
  below. `WaterBodyQuizScreen.tsx`, self-contained (setup → play → summary) rather than reusing
  the country quiz's screens, whose config surface is much bigger than this quiz needs.
  Local-only miss-tracking (not synced, no personal-bests/mastery-map integration — those were
  built incrementally for the country quiz as separate features and nothing here asked for them).
  Verified with a live Playwright smoke test against the running app (screenshots + a real
  answer-flow click-through), which caught a real bug the build/typecheck couldn't: `WorldMap`'s
  tiny-country dots (Vatican City, Nauru, ...) and microstate insets were rendering unconditionally
  underneath the new water-body markers, visually indistinguishable from the real targets — fixed
  with a new `showCountryMarkers` flag. Commit `8f6ad4e`.

- **US states / state capitals / state flags quiz — shipped.** All 50 states (not DC or
  territories — the backlog's own "50 states" framing), quizzable on name, capital, or flag, by
  find-it-on-the-map or type-it. Two decisions made with the user before building: (1) flag image
  source — Wikimedia Commons SVGs, self-hosted under `public/data/flags/us-states/`, same
  bundle-locally pattern as `countries-10m.json` rather than a live hotlink (see that folder's
  `SOURCE.md`); (2) how states are findable on the map at all — not explicitly called out in this
  entry originally, but the same problem as seas/oceans: `countries-10m.json` has the USA as one
  whole-country shape, no internal state borders, so there's no real polygon to tap. Extended the
  seas/oceans decision by consistency (each state marked at its capital's coordinates, reusing the
  exact same marker infra) rather than re-litigating or guessing a different answer.
  `UsStatesQuizScreen.tsx`, `usStates.ts`. Same scope boundary as seas/oceans: local-only
  miss-tracking, no sync/records/mastery-map integration. Verified live (Playwright): state
  markers cluster correctly over the US (dense in New England, Alaska/Hawaii correctly far afield),
  the flag category renders a real, correct SVG (spot-checked against Alabama/Texas/Colorado/New
  Mexico's actual flags), and a full answer round-trip works. Commit `1b71e6e`.

- **Crimea now depicted as part of Ukraine, not Russia — fixed.** Went with the surgical-cut
  approach over sourcing replacement boundary data (the topojson's `countries` object turned out
  to make this a clean, isolated edit, so replacing the whole boundary dataset wasn't needed).
  Inspected the actual topojson structure: Russia's `MultiPolygon` geometry had Crimea as exactly
  one self-contained polygon (`arcs[2]`, a single ring, no holes) — bbox 32.48–36.64°E /
  44.38–46.22°N, matching the peninsula precisely, with no other Russia polygon anywhere near that
  region (no separate islands/exclaves to also move). The two arcs making up that ring turned out
  not to be shared with any Ukraine polygon at the data level (Ukraine's mainland border along the
  Perekop isthmus uses different arc indices, 848 vs. Crimea's 847), so moving the polygon entry
  from `russia.arcs` to `ukraine.arcs` in `countries-10m.json` was a self-contained edit — no arc
  coordinates changed, no risk to any other country's geometry. Re-verified with the same
  point-in-polygon method (`d3-geo`'s `geoContains`) used to find the bug, both the original 5
  points (Simferopol, Sevastopol, Yalta, Kerch, Armiansk — now Ukraine, not Russia) and additional
  spread points across the peninsula (Tarkhankut in the west, the Kerch peninsula in the east,
  Sevastopol/Chersonesus, Feodosia, Dzhankoi) plus a mainland-Ukraine point just north of the
  isthmus to confirm the cut boundary itself is still sane. No test file added — same as the
  Brunei/Europe-microstates fixes below, there's no test harness for `geo.ts`/map-data at all
  (`packages/client` has no test runner); verified by build (`tsc -b` + `vite build`) + the engine
  suite staying green (51 tests) + the point-in-polygon script above, the same verification method
  used to find the bug in the first place.

- **Brunei's hitbox was too small to tap reliably — fixed.** Root cause found by actually running
  `getMapFeatures()` against the real topojson data (not just reasoning from the source): my
  first-pass estimate used raw lon/lat degrees, which don't match the app's real projected
  coordinate space (`geoNaturalEarth1().fitSize(...)`) — in that REAL space, Brunei's primary
  landmass bounding box is 2.88×3.22 units, just clearing the 2.2 `isTiny` threshold, so it was
  never getting the forgiving marker-dot treatment Vatican City/Palestine/etc. get. But measuring
  the actual land inside that box (shoelace polygon area vs. bbox area) showed only a 32% fill —
  a thin, jagged coastline (Brunei is a `MultiPolygon`: a main landmass plus the separate
  Temburong exclave, split off by Malaysia's Limbang corridor), the exact "bounding box
  overstates the real shape" problem `FORCE_TINY_IDS` already exists to patch for Palestine.
  Fixed by adding Brunei's id (`096`) to that same set (`geo.ts`) — verified via the same
  `getMapFeatures()` inspection that it now gets `isTiny: true` and a real `tapRadius` (12, the
  max — nothing else tiny sits anywhere near Borneo, so no marker-overlap risk). Build passes,
  engine suite green (51 tests).

- **A real fix for the mystery "capitals" records: a "clear my stats & history" reset.**
  Investigated 8/23/2026 (no bug found — the stray capitals records were real completed sessions,
  most likely leftover feature-verification testing from when the capitals category itself
  shipped, one day before the dates on those records) and the user decided the actual fix isn't
  more forensics — it's just being able to wipe the slate and start clean, synced from here on.
  Added: `resetSyncDoc` (`network/sync.ts`) overwrites an already-connected sync doc with an
  empty `{stats: {}, history: []}` (a plain local clear alone wouldn't stick while connected —
  the synced doc is the single source of truth and the next snapshot would just bring the old
  data right back); `useQuiz.ts`'s new `resetData()` clears local storage AND the synced doc (if
  connected) together; a "🗑️ Clear my stats & history" button + confirmation dialog on
  `SyncScreen.tsx`, available whether synced or not. Also confirmed while building this: sync
  already covers weak-spots tracking, not just personal-bests — `StatsMap` (what mastery/
  weak-spots reads) is part of the same `SyncDoc` as `history`, so the existing one-button
  "Start syncing" flow on the Home screen already keeps both in sync, no separate toggle needed.

- **Europe microstates inset dots were too small to tap reliably — fixed.** Root cause: unlike
  the main map's tiny-country markers, which get a separate, generous invisible tap radius
  layered on top of the visible dot (`tapRadiusFor` in `geo.ts`), the inset dots had no such
  padding — the visible dot (`r={hasContext ? 4 : 7}` in the inset's own viewBox units) WAS the
  entire click target, working out to roughly an 8-9px on-screen diameter for the Europe cluster
  specifically (well under any real touch-target guideline). Fixed by adding the same adaptive
  padded-tap-radius idea used on the main map, scoped per inset: each dot's radius is capped at
  half the distance to its nearest OTHER dot in the same inset (`INSET_MIN/MAX_TAP_RADIUS`,
  `tapRadiusFor` inside `buildInset`, `geo.ts`), rendered as an invisible circle under the visible
  dot (`WorldMap.tsx`). Verified with a full build + the engine test suite (51 tests, all
  passing) — no test file exists for `geo.ts`/`WorldMap.tsx` specifically, so this was checked by
  build + the existing suite staying green, not a new targeted test.

- **Flags stamped on answered countries** — "a good method of learning flags": once a country's
  answered (this session, any category/mode), its flag emoji is stamped at its centroid on the
  map, on top of the existing green/red tint, and stays there for the rest of the session —
  incidental flag-learning out of ordinary play instead of a dedicated mode. Skipped for the
  'flag' category (already the prompt for that question). `WorldMap`'s new optional `flagFor`
  prop, `QuizScreen.tsx`. Commit `8304123`.
- **Mastery map** — coloring every country by how well you know it (miss ratio → new/struggling/
  shaky/solid). Shipped as part of v1, not actually deferred — `MasteryScreen.tsx`, commit
  `93c65ab`.
- **Personal-best tracking** — a records screen with one best-ever session per (mode, scope,
  region) setup, ranked by accuracy first and time as a tiebreaker. `RecordsScreen.tsx`,
  commits `a5134d2`, `d66b862`, `b8bbbbc`.
- **More quiz categories** — flags and capitals as `QuizConfig.category` (findIt/typeIt reuse
  entirely unchanged — the prompt just shows a flag or a capital instead of the country name),
  plus a genuinely new `continent` QuizMode (6-button pick, since the answer there is a
  continent, not a country). Data (`capitals`/`languages`/`flagEmoji`) bulk-added to every
  `CountryDef`. Commits `bf45b38`, `437fe19`.
- **A hint system** — a "🤔 Hint" button on findIt/typeIt questions reveals the country's
  continent and first letter on tap; not offered for continent mode (already easy multiple
  choice). Commits `bf45b38`, `437fe19`.
- **A daily-challenge mode** — `useDailyChallenge` + `DailyChallengeScreen`: one deterministic
  flag-guessing question a day (djb2 hash of the local date), a persistent local streak counter,
  kept deliberately separate from the regular history/stats pipeline. Commits `bf45b38`, `437fe19`.
- **Atlas/browse mode with real facts** — `LookupScreen`'s detail panel now shows flag,
  capital(s), and languages. Deliberately NOT population — see `countries.ts`'s header comment;
  the `world-countries` data source doesn't carry it, and hand-typing/guessing 197 numbers that
  go stale immediately wasn't worth it for a quick reference. Commits `bf45b38`, `437fe19`.
- **Multiple-choice mode** — first marked "not planned as separate work" on the assumption that
  findIt (map-tap) already covered the "gentler recognition mode" idea; that was wrong — what
  was actually wanted was a genuine 4-option button pick, separate from hunting the full map.
  Added as its own `QuizMode` ('multipleChoice'): same prompt as findIt (crosses with `category`
  the same way), 4 buttons (target + up to 3 random distractors from the session's own pool),
  answered with the same `{ type: 'findIt' }` Answer findIt itself uses — no engine changes
  needed beyond the mode value. Commit `e6e8418` (also fixed a feedback-timing bug found while
  building it: submitAnswer advances `current` to the NEXT question in the same update that adds
  the result, so naively deriving "which button was right" from live state during the feedback
  flash showed the wrong question's answer — fixed by freezing the answered question's own
  options/correct-id at pick-time instead of re-deriving them live).
