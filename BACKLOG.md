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

- **Mystery "capitals" personal-best records — needs investigating.** On 8/23/2026 the user
  found real `Find it (capitals)` records on the Records screen — Oceania 14% (1x), South
  America 100% (3x), North America 100% (7x), Europe 89% (5x), all last played 8/20/2026 — and
  is certain they never deliberately played capitals mode, on this or any device. Ruled out so
  far by reading the code: no bug/mislabeling exists — a `SessionRecord` only ever gets
  `category: 'capital'` when a session actually completes with that category selected
  (`useQuiz.ts`); there's no seed/demo data (`loadHistory()` starts empty); Daily Challenge never
  writes to this pipeline at all. Suspicious lead, not yet confirmed: 8/20-8/21/2026 is exactly
  when the capitals category itself was built and shipped (commits `bf45b38`, `437fe19`, dated
  2026-08-21) — the volume and spread (16 sessions across 4 regions, first attempt bad then
  climbing to 100%) reads like systematic feature-verification testing from that build, not
  accidental taps. Two live theories, neither confirmed: (a) that testing happened on a
  synced-in device/browser (check whether a sync code is currently connected on the user's
  device — `SyncScreen.tsx` — that would explain another device's sessions merging into this
  history); (b) it was genuinely run against the live production site during that original build
  and somehow reached this account, which would need reconstructing from whatever session did
  that original build (predates traceable context here). Needs: confirm which theory is right,
  then decide whether to just clear these specific stray records once the cause is nailed down.
- **US states / state capitals / state flags quiz — new feature, not built.** Confirmed nothing
  like this exists today: `countries.ts` is sovereign-nation data only (the one "United States"
  row is the country itself, not its states), no `usStates.ts` or similar file exists anywhere in
  the repo. Would need its own new dataset — 50 states, each with a capital and (unlike
  countries, which get away with a `flagEmoji`) a real state flag image, since there's no emoji
  set for US state flags — plus a way to pick "US States" as a distinct quiz universe in Setup,
  parallel to but separate from the existing country/continent scope. Not scoped or designed
  beyond this — first real step whenever it's picked up is deciding on a data source for the 50
  state flag images (likely SVG, similar sourcing problem to how country flag data was originally
  bulk-added).

## Done

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
