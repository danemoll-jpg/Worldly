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

_(nothing currently open — everything below is either shipped or deliberately not planned)_

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
