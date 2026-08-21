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

## Not planned as separate work

- **Multiple-choice vs. type-the-name toggle** — came up as its own idea, but Worldly's existing
  `findIt` (recognize it on the map) / `typeIt` (recall and type it) modes already are that
  distinction — a gentler recognition mode and a harder recall mode, both available as a toggle.
  Not tracked as a separate open item unless there's a reason the map-tap version doesn't cover
  what was actually wanted (e.g. a plain 4-option text list instead of the map).

## Done

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
  `CountryDef`. See PENDING_COMMIT.
- **A hint system** — a "🤔 Hint" button on findIt/typeIt questions reveals the country's
  continent and first letter on tap; not offered for continent mode (already easy multiple
  choice). See PENDING_COMMIT.
- **A daily-challenge mode** — `useDailyChallenge` + `DailyChallengeScreen`: one deterministic
  flag-guessing question a day (djb2 hash of the local date), a persistent local streak counter,
  kept deliberately separate from the regular history/stats pipeline. See PENDING_COMMIT.
- **Atlas/browse mode with real facts** — `LookupScreen`'s detail panel now shows flag,
  capital(s), and languages. Deliberately NOT population — see `countries.ts`'s header comment;
  the `world-countries` data source doesn't carry it, and hand-typing/guessing 197 numbers that
  go stale immediately wasn't worth it for a quick reference. See PENDING_COMMIT.
