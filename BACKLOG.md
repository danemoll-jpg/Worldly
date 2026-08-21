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

- **More quiz categories from the same country data** — capitals ("which is the capital of
  Peru?"), flags (matching a flag to a country — probably the single most popular geography-quiz
  category that exists), or continents ("which continent is this in?"). Not new architecture,
  just new question shapes drawing from `countries.ts`'s existing dataset; `QuizMode`'s own doc
  comment already flags this as intentionally deferred rather than designed out; `CountryDef`
  has no capital/flag fields yet, so those need adding to the dataset first.

- **A hint system** — mirrors the "what should I play?" hint button pattern from the card games
  in this series: "reveal the continent," "show the first letter," that kind of thing, for when
  you're stuck instead of just failing outright.

- **A daily-challenge mode** — one deterministic country/flag/etc. per day (same idea as
  Wordle), a low-effort engagement hook since it's just "pick today's item from a seeded/
  date-based index," nothing architecturally hard.

- **Atlas/browse mode with real facts** — the browse/lookup screen already exists
  (`LookupScreen.tsx`) but only shows name + continent on tap. Once population/capital/language
  are worth adding to `countries.ts` (see the quiz-categories item above — likely the same data
  work), showing them here too costs almost nothing extra and makes lookup mode a genuinely
  useful reference, not just a quiz pre-screen.

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
