# Worldly 🌍

> **About this branch (`no-deploy`):** this branch exists to hand off commits that are finished
> but not yet on `claude/local-projects-github-vekss2` — the branch Netlify actually builds from
> for this site. Pushing to a *new* branch name doesn't trigger a Netlify build (only pushes to
> the deploy branch do), so this is a safe place to land work and clone from locally without
> spending a deploy. Don't merge this into the deploy branch on its own — that's a separate,
> deliberate decision each time.

A geography study app — an interactive, pannable/zoomable map for learning **countries, US
states, and seas & oceans**, not just the well-known ones (197 countries, right down to
Tuvalu; all 50 states; 20 major seas/oceans).

Unlike the timed, all-or-nothing quiz sites this was built to improve on, everything here is
**untimed** (your time is recorded as a stat, never enforced as a deadline) and there's a real
middle ground between "quiz me on everything" and "quiz me on nothing" — you can drill just
the ones you keep missing.

Includes:
- **Three quiz universes**, picked from tabs under "Start a quiz": **Countries** (all 197, four
  modes below), **US states** (all 50, real state borders), and **Seas & oceans** (20 major
  bodies of water, real coastline-accurate borders). Each tracks its own stats, mastery map, and
  records independently — a full-world countries run and a US-states run aren't comparable
  challenges, so they're never mixed into one score.
- A real **flat world map**, sized to actually use the screen — pan by dragging, zoom with the
  mouse wheel or a two-finger pinch (works on touch devices, including iPad), reset-view
  button. Country boundaries are public-domain data (Natural Earth, via the `world-atlas`
  package); US state boundaries are from the `us-atlas` package; sea/ocean boundaries are
  Natural Earth's marine-polygons layer — none of it scraped or licensed.
- **Tap anywhere inside a shape** — no dot-only fallback for any of the three universes. Real
  countries, US states, and water bodies are all clickable across their full outline, not just a
  marker at their center. For US states and seas/oceans, a **"Show outlines / Hide until
  answered"** toggle controls only whether the border is drawn before you answer — tap accuracy
  is identical either way, and an answered region's real border (plus its flag, for states)
  always reveals itself regardless of the toggle.
- **Tiny countries stay findable.** Most (Nauru, Malta, Tuvalu, and a couple dozen others) get
  a small marker dot at their centroid instead of relying on their sub-pixel real shape — a
  constant size on screen no matter how far you're zoomed. A handful sit too close to OTHER
  tiny countries for any dot to disambiguate (Vatican City is a couple hundred km from San
  Marino; several Eastern Caribbean island states are even closer) — those get pulled into a
  small zoomed-in **inset box** in a corner of the map instead, the same fix real atlases use
  for exactly this problem, so tapping "right on top of" one never resolves to its neighbor.
  The Europe microstates inset also draws the real surrounding geography (Italy, France,
  Switzerland, the Balkans, ...) underneath the dots, not just empty space, so each one sits
  somewhere recognizable instead of floating in a void.
- **Four quiz modes for countries**: **find it** (a country's named, tap it on the map),
  **type it** (a country's highlighted, you type its name — lenient about typos and alternate
  names like "USA" or "Czechia" vs. "Czech Republic"), **multiple choice** (same prompt as find
  it, pick from 4 buttons instead of searching the whole map — with an easy/hard difficulty
  toggle for how plausible the wrong options are), and **continent** (a country's named, pick
  which of the 6 continents it's in). US states and seas/oceans each offer find it and type it.
- **Three prompt categories for countries** (find it/type it/multiple choice): the country's
  **name**, its **flag**, or its **capital**. US states offer the same three. Every flag shown —
  quiz prompts, the map's flag-stamping, the atlas panel — is a real bundled SVG image, not a
  Unicode flag emoji: several platforms (Windows/Chrome included) don't render regional-indicator
  emoji as flags at all, so an emoji-only approach silently broke for some countries (even common
  ones, not just obscure small nations) depending on what OS/browser you're on.
- An optional **hint button** on any find it/type it/multiple choice question — reveals the
  continent and (unless the name's already shown) the first letter, without ending the question.
- **Region filtering** for the countries quiz — quiz just one continent, several, or everything.
- **Miss-weighted quizzing** — every session remembers what you've gotten wrong before and
  leans the question order toward it; a "just my weak spots" mode quizzes ONLY items
  you've missed at least once, so you're never stuck choosing between the full set and nothing.
- **Already-answered items are marked on the map** as you go (and, for countries and US states,
  stamped with their flag once revealed), so mid-quiz you can see at a glance what's left. A
  **skip button** lets you set aside a question you're blanking on and come back to it later in
  the same session, instead of being stuck staring at it or guessing.
- A **daily challenge** — one shared "find this flag" question a day, the same for everyone,
  with a day-streak counter for answering correctly. Untimed like everything else, but capped at
  one attempt per day.
- A **mastery map** with tabs for all three universes — colored by how solid you are on each
  item (new / struggling / shaky / solid), the payoff view for all that miss-tracking.
- A **browse/atlas mode** for countries — search or tap around the map with zero pressure, see
  name, flag, capital(s), and languages, just to look something up.
- **Session stats** — completion time and percent correct, shown on the summary screen with a
  "new best" badge when you beat your own record for that exact quiz setup. Recorded, never a
  gate. A **records screen**, split into a section per universe, lists your best time and best
  accuracy for every quiz setup you've actually completed — there's no single "top score," since
  different setups aren't comparable challenges.
- No bots, no opponents — this is a solo study tool, not a game against anyone. Works entirely
  locally (localStorage) with zero setup; optionally, **sync your stats and history across your
  own devices** with a shared code — no account, same "the code is the access control" trust
  model as the online rooms in the rest of this series (see "Deploying" below to turn it on).
  Sync covers all three quiz universes, and there's a one-tap **reset** to clear all stats and
  history (synced or local-only) if you want a clean slate.

## Quick start

```bash
npm install
npm run dev
```

That builds the shared quiz engine, then starts the Vite dev server for the client (no backend
process — the app is a pure static site). The terminal will print the URL — Vite defaults to
`http://localhost:5173`, but picks the next free port if that one's taken.

### Tests

```bash
npm run test
```

Runs the engine's test suite: lenient answer-matching (aliases, typo tolerance, and the cases
that should NOT match), miss-weighted session ordering, the full session lifecycle (region/scope
filtering, scoring, summaries) for countries plus the shared generic session logic US
states/seas-oceans reuse, stats bucketing, the daily challenge, and data-integrity checks on the
curated country/US-state/water-body lists themselves.

## How it works (short version)

- Pick a quiz universe (Countries, US states, or Seas & oceans) from the tabbed picker.
- For countries: pick a mode (find it / type it / multiple choice / continent), a prompt
  category (name / flag / capital, where applicable), which regions to include, and whether to
  cover everything or just your weak spots. US states and seas/oceans have a smaller version of
  the same setup screen (mode, category, scope — no region filter, since there's only one
  region).
- **Find it**: an item's named — tap it on the map (a marker dot for tiny countries; a real
  border-accurate shape for US states and seas/oceans).
- **Type it**: an item's highlighted on the map — type its name. No rush; typos and known
  alternate names are forgiven (see `packages/engine/src/matching.ts`).
- **Multiple choice** / **Continent** (countries only): pick from a short button list instead of
  the map or the keyboard.
- Every item in your selected pool gets asked exactly once per session, in an order biased
  toward whatever you've missed most before. Items you've already answered this session are
  shaded differently on the map; hit **Skip for now** on one you're blanking on and it moves to
  the back of the queue instead of being scored — it'll come back around before the session
  ends (see `skipCurrent` in `packages/engine/src/session.ts`).
- At the end: your percent correct, your time, and (if you beat a previous run at this exact
  setup) a "new best" badge.

## Project structure

```
packages/
  engine/   Pure quiz logic — the curated 197-country/50-state/20-water-body lists, lenient
            answer matching, miss-weighted question ordering, the countries-specific session
            state machine plus a generic one US states/seas-oceans share, the daily challenge,
            and stats bucketing. No UI, no rendering, no storage; fully unit-tested (vitest).
  client/   React + Vite UI. No backend at all:
            - The map (packages/client/src/components/WorldMap.tsx) is a from-scratch
              pan/zoom SVG surface (see src/lib/panZoom.ts) built on the Pointer Events API,
              so mouse and touch share one code path. It renders the ordinary country layer
              plus an optional `regions` layer (real US-state or water-body shapes) on top,
              used by UsStatesQuizScreen/WaterBodyQuizScreen/MasteryScreen.
            - Boundary data (src/lib/geo.ts) — country, US-state, and water-body geometry alike
              — is projected once with d3-geo (Natural Earth 1 projection) and cached for the
              page's lifetime.
            - Real flag SVGs live under public/data/flags/{countries,us-states}/, bundled from
              MIT-licensed sources rather than relying on emoji rendering — see each folder's
              SOURCE.md for provenance and how to regenerate.
            - QuizPickerScreen is the tabbed entry point into the three quiz universes;
              QuizScreen/UsStatesQuizScreen/WaterBodyQuizScreen are their respective play
              screens, and DailyChallengeScreen is the separate one-a-day feature.
            - Per-item stats and session history persist to localStorage
              (src/lib/storage.ts) by default, or to a shared Firestore document once
              cross-device sync is turned on (src/network/sync.ts) — see hooks/useQuiz.ts for
              how a session ties the engine, storage, sync, and UI together across all three
              universes plus the daily challenge.
```

## The country list — what's in, what's out, and why

197 countries are quizzable. `packages/engine/src/countries.ts` documents the reasoning inline,
but the short version:

- **In**: all UN member states, plus Taiwan, Kosovo, Vatican City, and Palestine — matching how
  they're already treated as distinct entities in the underlying boundary dataset and how most
  general-purpose geography references/quizzes handle them.
- **Out** (still drawn on the map as background, just never asked about): colonial/overseas
  territories and dependencies (Puerto Rico, Bermuda, French Polynesia, Hong Kong, Greenland,
  Gibraltar, ...), Antarctica, and a small number of disputed/unrecognized regions (Northern
  Cyprus, Somaliland, Western Sahara) — the app deliberately doesn't take a position on those,
  same "lean on the neutral, widely-used convention" approach used for the rest of the data.

The boundary data is deliberately the **10m-resolution** file from the `world-atlas` package,
not the smaller 50m/110m ones that package also ships — the coarser files quietly drop the
smallest states entirely (Tuvalu, for one), and completeness down to the smallest countries is
the whole point of this app. US state boundaries are the equivalent 10m file from `us-atlas`.
Water body boundaries are a filtered subset (20 of ~300 features) of Natural Earth's own
`ne_10m_geography_marine_polys` marine-polygons layer, split where a body needed it (e.g. North
vs. South Atlantic/Pacific) to match how the quiz asks about them.

### Real bugs this app's build turned up

- **Maldives** in the 10m country dataset is made of ~176 tiny atoll rings only fractions of a
  degree apart, which occasionally trips an edge case in `d3-geo`'s adaptive path resampling:
  one ring projects to a shape covering almost the entire map instead of a few pixels near the
  equator, silently painting over every other country underneath it. The same class of bug
  showed up again in the North Atlantic Ocean's water-body polygon (a legitimate `Polygon` with
  ~25 degenerate hole rings, not a `MultiPolygon` piece). `packages/client/src/lib/geo.ts` works
  around both defensively: every ring is projected individually, and any HOLE ring (never the
  outer boundary) whose bounds are implausibly large (wider than ~75% of the map AND taller than
  ~70% — a signature no real single landmass/hole ring should ever hit, not even Russia's
  mainland) gets dropped rather than rendered. Worth knowing about if this ever needs revisiting
  for a different resolution/version of the underlying data.
- A CSS stylesheet rule always outranks an SVG presentation attribute — `.world-map__region` once
  had a hardcoded `stroke` color in the stylesheet, which silently overrode whatever color the
  US-states/seas-oceans screens' `regionStrokeFor` tried to set (including `'transparent'`),
  so the "hide outlines until answered" toggle never actually hid anything. Fixed by removing the
  CSS color and requiring every caller of the map's `regions` layer to set its own stroke
  explicitly.

## Cross-device sync

Optional, and purely additive — everything above works with zero setup either way. Turn it on
from the home screen ("Sync devices"):

- **Start syncing** generates a short code and seeds a shared Firestore document with whatever
  stats/history are already on this device, across all three quiz universes plus the daily
  challenge streak.
- **I have a code** connects another device to that same code — the two devices' progress is
  merged once (summed, not overwritten, so neither side loses anything), and from then on both
  read/write the same shared copy. A session finished on one device shows up on the other
  automatically (a live Firestore subscription, not a manual refresh).
- **Disconnect** just stops this device from syncing — it keeps using its last-known data
  purely locally afterward; nothing is deleted, on this device or in the cloud.
- **Reset** clears all stats and history — synced or local-only — for a clean slate, without
  needing to uninstall/clear browser storage by hand.

There's no account system anywhere in this series — the code itself is the only thing tying
your devices together, same trust model as an online room code. See `firestore.rules`' comments
for the accepted tradeoff that comes with that (fine for a personal study log; not a guarantee
against a determined attacker).

## Deploying

1. **Static site build**: `npm run build` (root) builds the engine, then the client to
   `packages/client/dist`. Host that directory anywhere that serves static files — Netlify,
   Vercel, GitHub Pages, Cloudflare Pages, all work with zero server-side config. This repo's
   `netlify.toml` already has the build command and publish directory set for Netlify
   specifically — just "Import from Git" and deploy. This alone gets you the whole app, sync
   included in the UI — it just won't successfully connect until the next step is done.
2. **Firebase (only needed for cross-device sync)**: create a project at
   [console.firebase.google.com](https://console.firebase.google.com), enable **Firestore**
   (Standard edition). In Project Settings → General → Your apps, add a Web app and copy its
   config object into `packages/client/src/network/firebase.ts` (it currently has
   `REPLACE_ME` placeholders). Then paste this repo's `firestore.rules` into
   Firestore → Rules → Publish. No environment variables needed at build time — the Firebase
   web config isn't a secret (access control is enforced by `firestore.rules`, not by hiding
   the config), so it just gets committed directly in `firebase.ts` once filled in.

## Extending this later

Ideas discussed and deliberately deferred rather than built into v1 — see
[BACKLOG.md](./BACKLOG.md) for the current list and what's already shipped since.
