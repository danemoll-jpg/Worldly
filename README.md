# Worldly 🌍

A geography study app — an interactive, pannable/zoomable world map for learning every
country, not just the well-known ones (197 of them, right down to Tuvalu).

Unlike the timed, all-or-nothing quiz sites this was built to improve on, everything here is
**untimed** (your time is recorded as a stat, never enforced as a deadline) and there's a real
middle ground between "quiz me on everything" and "quiz me on nothing" — you can drill just
the countries you keep missing.

Includes:
- A real **flat world map** — pan by dragging, zoom with the mouse wheel or a two-finger pinch
  (works on touch devices, including iPad), reset-view button. Country boundaries are
  public-domain data (Natural Earth, via the `world-atlas` package), not anything scraped or
  licensed.
- **Two quiz modes**: "find it" (you're told a country's name, tap it on the map) and "type
  it" (a country's highlighted, you type its name — untimed, and lenient about typos and
  alternate names like "USA" or "Czechia" vs. "Czech Republic").
- **Region filtering** — quiz just one continent, several, or everything.
- **Miss-weighted quizzing** — every session remembers what you've gotten wrong before and
  leans the question order toward it; a "just my weak spots" mode quizzes ONLY countries
  you've missed at least once, so you're never stuck choosing between the full 197 and nothing.
- A **mastery map** — the whole world colored by how solid you are on each country (new /
  struggling / shaky / solid), the payoff view for all that miss-tracking.
- A **browse mode** — search or tap around the map with zero pressure, just to look something
  up.
- **Session stats** — completion time and percent correct, shown on the summary screen with a
  "new best" badge when you beat your own record for that exact quiz setup. Recorded, never a
  gate.
- No bots, no opponents — this is a solo study tool, not a game against anyone. Works entirely
  locally (localStorage) with zero setup; optionally, **sync your stats and history across your
  own devices** with a shared code — no account, same "the code is the access control" trust
  model as the online rooms in the rest of this series (see "Deploying" below to turn it on).

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
filtering, scoring, summaries), stats bucketing, and a data-integrity check on the curated
country list itself.

## How it works (short version)

- Pick a quiz mode, which regions to include, and whether to cover everything or just your
  weak spots.
- **Find it**: a country's named — tap it on the map.
- **Type it**: a country's highlighted on the map — type its name. No rush; typos and known
  alternate names are forgiven (see `packages/engine/src/matching.ts`).
- Every country in your selected pool gets asked exactly once per session, in an order biased
  toward whatever you've missed most before.
- At the end: your percent correct, your time, and (if you beat a previous run at this exact
  setup) a "new best" badge.

## Project structure

```
packages/
  engine/   Pure quiz logic — the curated 197-country list, lenient answer matching,
            miss-weighted question ordering, session state machine, and stats bucketing.
            No UI, no rendering, no storage; fully unit-tested (vitest).
  client/   React + Vite UI. No backend at all:
            - The map (packages/client/src/components/WorldMap.tsx) is a from-scratch
              pan/zoom SVG surface (see src/lib/panZoom.ts) built on the Pointer Events API,
              so mouse and touch share one code path.
            - Country boundary data (src/lib/geo.ts) is projected once with d3-geo
              (Natural Earth 1 projection) and cached for the page's lifetime.
            - Per-country stats and session history persist to localStorage
              (src/lib/storage.ts) by default, or to a shared Firestore document once
              cross-device sync is turned on (src/network/sync.ts) — see hooks/useQuiz.ts for
              how a session ties the engine, storage, sync, and UI together.
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
the whole point of this app.

### A real bug this app's build turned up

One country in the 10m dataset — Maldives, made of ~176 tiny atoll rings only fractions of a
degree apart — occasionally trips an edge case in `d3-geo`'s adaptive path resampling, where
one ring projects to a shape covering almost the entire map instead of a few pixels near the
equator, silently painting over every other country underneath it. `packages/client/src/lib/geo.ts`
works around this defensively: every `MultiPolygon` feature is projected ring-by-ring, and any
individual ring whose bounds are implausibly large (wider than ~75% of the map AND taller than
~70% — a signature no real single landmass ring should ever hit, not even Russia's mainland)
gets dropped rather than rendered. Worth knowing about if this ever needs revisiting for a
different resolution/version of the underlying data.

## Cross-device sync

Optional, and purely additive — everything above works with zero setup either way. Turn it on
from the home screen ("Sync devices"):

- **Start syncing** generates a short code and seeds a shared Firestore document with whatever
  stats/history are already on this device.
- **I have a code** connects another device to that same code — the two devices' progress is
  merged once (summed, not overwritten, so neither side loses anything), and from then on both
  read/write the same shared copy. A session finished on one device shows up on the other
  automatically (a live Firestore subscription, not a manual refresh).
- **Disconnect** just stops this device from syncing — it keeps using its last-known data
  purely locally afterward; nothing is deleted, on this device or in the cloud.

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

The v1 scope deliberately left a few ideas for later, all discussed as natural extensions of
the existing data/architecture rather than new categories of work:
- **More quiz categories** using the same country data: flags (matching a flag to a name),
  capitals, or "which continent is this in."
- **A hint system** for the quiz — "reveal the continent" or "show the first letter" — same
  spirit as the hint buttons in the rest of this games series, just without a bot/opponent to
  base it on.
- **A daily challenge** — one deterministic country/flag per day (seed off the date), a low-
  effort engagement hook.
- **An atlas/detail panel** in browse mode with real facts (population, capital, language) once
  that metadata is worth adding to `countries.ts`.
