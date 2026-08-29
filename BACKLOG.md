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

- **Global leaderboard — code complete, blocked on one manual step.** Everything is built (see
  Done below) and verified as far as automated testing can reach — the one thing left is YOU
  pasting the updated `firestore.rules` into the Firebase console (Firestore → Rules → Publish;
  see README's "Deploying" section). Until that's done, every submission/fetch fails closed (the
  UI shows "couldn't reach the leaderboard" rather than crashing, but nothing actually saves or
  loads). Once published, worth a real end-to-end check — start a full countries/US-states/water-
  bodies quiz, confirm the score lands on the right board. A "PlaywrightTester" test entry may
  show up on the seas & oceans board the first time this genuinely goes through — safe to ignore
  or delete from the Firestore console, it's just leftover verification data.

- **Push notifications for the daily challenge.** User specifically likes this idea. A reminder
  that arrives even when the app is closed needs more than the service worker added for offline
  support — it needs a push subscription plus something that actually decides "send it now,"
  which means a small scheduled Firebase Cloud Function (once-a-day trigger). This requires
  enabling Firebase's Blaze (pay-as-you-go) plan first — a card on file, though real cost at this
  scale is $0/month — which only the user can do from the Firebase console. Blocked on that step;
  ping the user for it when this is picked up. Do this one last, after the leaderboard, since it's
  the only piece with an external dependency outside the codebase.

- **Capacitor wrap for real App Store / Play Store distribution.** Longer-term, after the PWA
  work above is solid. Goal isn't really Worldly-the-business (geography quizzes are a saturated,
  mostly-free category — Sporcle, Seterra, GeoGuessr, Countryle already own it) so much as using
  a low-stakes, already-built app to learn the actual store-submission pipeline once (developer
  accounts, screenshots, privacy policy, review process, TestFlight) — a skill that transfers to
  whatever app eventually is worth monetizing seriously.

## Done

- **Global leaderboard — built, verified as far as possible without the rules being live (see
  Open above for the one remaining manual step).** Scope: a top-10 board per quiz type
  (Countries / US States / Seas & Oceans), ranked by best % correct with time as a tiebreak —
  only the standard full quiz counts (find it on the map, everything included), so a weak-spots
  run or the flags/typing categories don't pollute the comparison. New files:
  `network/leaderboardIdentity.ts` (a locally-generated playerId + a display name chosen once),
  `network/leaderboard.ts` (Firestore read/write + the eligibility rules above),
  `hooks/useLeaderboardSubmission.ts` + `components/LeaderboardSubmission.tsx` +
  `components/DisplayNamePrompt.tsx` (the submit-on-completion flow, shared across all three quiz
  screens rather than tripled), `components/LeaderboardScreen.tsx` (the viewing screen — top 10
  plus your own rank if you're outside it). `firestore.rules` gained a `/leaderboard/{quizType}
  /entries/{playerId}` match block: bounds-checks the shape and only allows a write that's an
  actual improvement over your own prior entry — same "not airtight against a determined
  attacker, blocks casual tampering" tradeoff `/syncs` already documented, written up again in
  the rules file since this data is public rather than behind a private code. Verified via
  Playwright against the real Firebase project: completed a full 20-question seas & oceans quiz,
  confirmed the "eligible for leaderboard" prompt appeared, submitted a display name, and
  confirmed the submission attempt fired correctly — the actual write/read currently fails closed
  exactly as expected since the rules above aren't published yet (see Open).

- **Offline support (real PWA) — shipped.** Add-to-Home-Screen already worked (manifest.json +
  apple-touch-icon, from an earlier session), but the installed app was still fully broken
  offline. Added vite-plugin-pwa: precaches the app shell (JS/CSS/HTML/icons) at build time,
  runtime-caches the map data JSON (~4MB) and flag SVGs (~9.4MB) and sounds the first time each
  is actually fetched rather than force-downloading all ~13MB on first visit. Verified via
  Playwright against a real production preview build: after playing a quiz online (populating the
  runtime caches) and then actually going offline, a full reload still renders the home screen
  and a brand-new quiz still renders the map from cache. Commit `84a8c28`.

- **"Actually, that was right" override button — shipped.** User: "I just think I need to have a
  'that was right' button. Was doing all countries got like 160 countries in clearly hit san
  marino but it said I missed it. Very annoying to miss when i didnt really miss it." Two parts:
  the immediate San Marino bug (see the inset tap-radius entry below) plus this standalone
  feature, valuable independent of any specific bug. Engine:
  `overrideLastResultAsCorrect`/`overrideLastGenericResultAsCorrect` flip only the most recent
  result from wrong to correct (no-op if already correct or no results yet — never touches
  anything further back, so it's unambiguous which answer is being corrected). Wired into all
  three quiz screens; wrong-answer feedback now stays up 4s (was 1.2s) so there's a real window
  to use it. Found and fixed a real regression during verification: the override's `setSession`
  call re-triggers each screen's combined "detect new answer + schedule feedback auto-clear"
  effect without growing `session.results`, landing in the branch that cancels the pending clear
  timer but never reschedules one — leaving feedback stuck non-null forever, which silently
  blocked all further taps (every screen's tap handler no-ops while feedback is showing) for the
  rest of the session. Fixed by splitting each screen's effect in two, with the auto-clear timer
  keyed on `feedback` itself so it re-arms on any change, override included. Verified via
  Playwright: a full session with a mid-session override completed normally end-to-end, correctly
  scored, with the overridden country excluded from "missed this round"; a separate stress run
  confirmed taps kept registering for 6+ more questions after an override (previously: stuck
  forever, one question after). Commit `e6dc199`.

- **San Marino/Vatican (and Caribbean) inset tap-radius overlap — fixed.** Root cause of the
  report above. `buildInset()`'s tap-radius floor (`INSET_MIN_TAP_RADIUS`, 11) was unconditional
  — applied regardless of how close two dots' real centroids actually were. San Marino and
  Vatican's real inset centroids are only ~0.98 units apart, so both got radius-11 circles
  reaching ~10x past their actual gap; whichever won a DOM z-order tie could steal taps clearly
  aimed at the other. Same bug affected the Caribbean inset group (St Vincent & Grenadines /
  Saint Lucia; Antigua & Barbuda / St Kitts & Nevis). Identical bug class to the New
  Hampshire/Vermont region-tap-radius fix from earlier, just never ported to this separate inset
  system. Fix: removed the floor entirely (`Math.max(0, halfGap)` instead), reduced the margin
  from 1 to 0.3 unit (some real pairs are under 1 unit apart). Verified via Playwright: all 12
  inset dots (5 Europe microstates + 7 Caribbean) resolve to themselves when clicked at their own
  center. Commit `3225f85`.

- **Sound effects genuinely louder — shipped.** User: "I can't even hear it (unless it is
  possible for you to make it louder)" — the incorrect-answer cue. Root cause: the old
  playback used a plain HTMLAudioElement, whose `.volume` tops out at 1.0 (never louder than the
  clip's own recorded level, and this one was deliberately mixed quiet). Switched to the Web
  Audio API (AudioContext + GainNode), which has no such ceiling — added a per-cue gain
  multiplier, 'incorrect' boosted 2.5x over the shared baseline. Same public API, no other file
  touched. Verified live by intercepting the actual gain value applied (1.75, genuinely past
  what the old approach could reach). Commit `f7e70f1`.

- **Gambia too easy to miss — fixed, without swallowing Senegal.** Same "bbox overstates the
  shape" family as Brunei/Solomon Islands/Vanuatu, but the usual fix (adaptive nearest-tiny-
  neighbor radius) isn't safe here on its own — Gambia's real neighbor Senegal (which wraps
  around it on three sides) has its own centroid only ~4.8 units from Gambia's, while the
  nearest OTHER tiny-marker country is 23.72 units away and wouldn't constrain anything. Added a
  new per-country tap-radius override (1.8 units, comfortably under half the real gap to
  Senegal's centroid) rather than the standard unclamped max. Verified live, including a
  properly-redone check of Senegal's own real centroid (not its bounding-box center, which for a
  shape wrapping a neighbor isn't the same thing — the Norway/Chile lesson again) resolving
  correctly to Senegal. Commit `e102d58`.

- **Sound effects — shipped, waiting on real audio files.** User request: correct/incorrect
  answer cues, plus quiz-finish/finish-100%/finish-new-record. The user is generating the actual
  clips externally (ElevenLabs Studio) rather than sourcing/licensing them, so this shipped the
  full plumbing + a written spec — no audio files are in the repo yet, and the app runs
  identically with or without them. New `lib/sound.ts` (cached-Audio playback, localStorage
  on/off preference, the priority logic for which "finish" cue fits — new record beats perfect
  beats plain); wired into correct/incorrect detection in all three quiz screens and each one's
  own completion moment; a small sound on/off toggle on the home screen. See
  `packages/client/public/sounds/SOURCE.md` for the exact 5 filenames expected and the
  generation prompts (written to avoid retro/chiptune register, per the user's explicit ask).
  Commit `5d7af3d`.

- **Mastery map: tap a shape to see its name/level/history — shipped.** User request: "on the
  mastery screen, can we click on the area to see the country (or the lake, sea or state)?" A
  detail card (reusing the browse/atlas screen's own styling) appears below the map on tap,
  showing name, mastery level, flag where one exists (countries/US states), and — once actually
  quizzed at least once — real seen/missed counts. Works across all three universe tabs; clears
  on tab switch. Verified live, including a full quiz session run to completion to check the
  "already quizzed" state (stats only persist when a session finishes, not per-question).
  Commit `aeb747d`.

- **Solomon Islands and Vanuatu too small to tap reliably — fixed.** User: "I click on them but
  have to click around a little before they are recognized." Neither was actually tiny by size
  (both over the 2.2-unit threshold), but both are scattered archipelagos — 48 and 27 separate
  island pieces — spread across a bounding box much bigger than the real clickable land, the
  same "bbox overstates the shape" problem Brunei had. Added both to the existing
  `FORCE_TINY_IDS` override list after confirming they're a safe ~28.6 units from any other
  tiny-marker country (no overlap risk). Commit `58a669c`.

- **Fiji's flag showing west of Angola — fixed.** User report, noticed on the deployed (pre-fix)
  app. A different root cause than the Russia/Norway/Chile bug even though it looks like the
  same family: Fiji's raw data includes a degenerate d3-geo resampling artifact ring (948.3
  units wide, only 2.7 tall — ~357:1 aspect ratio) that the existing MAX_PLAUSIBLE_RING_WIDTH/
  HEIGHT filter doesn't catch (by design — that filter only drops a ring implausible in BOTH
  dimensions, so it doesn't also drop Russia's legitimately very-wide mainland). Since Fiji's
  real islands are small, this sliver's bounding-box area still won "biggest piece" and got
  picked as primary, so even the already-fixed polylabel logic correctly found a point in the
  middle of a FAKE shape spanning most of the map. Fixed by excluding pieces with an implausible
  aspect ratio (>20:1) from primary-piece ELIGIBILITY specifically (not from rendering, where a
  degenerate sliver is harmless) — verified against all 197 quizzable countries first, Fiji was
  the only one anywhere near that threshold. Re-verified the full containment sweep and live in
  the app. Commit `6e9fd36`.

- **Russia's flag showing near the UK, Norway's in Sweden, Chile's in Argentina — fixed.** User
  reports, all from directly noticing wrong flag placement on the map (Chile's noticed right
  after the first pass at this, since that pass only partly fixed it — see below). Root cause:
  every country's marker/flag was placed at the bounding-box CENTER of its largest polygon
  piece. First pass switched that to d3-geo's proper area-weighted geometric centroid, which
  fixed Russia (mainland is one un-split piece spanning ~80% of the map's width — antimeridian
  wrap — whose bbox center landed near Scandinavia) and looked right for Norway/Chile in a
  screenshot at the time. It wasn't actually enough for either of those two, though — verified
  properly afterward with a real point-in-polygon containment check (not just eyeballing a
  screenshot): a true geometric centroid of a long, thin, CURVED coastal strip can itself fall
  outside the strip, in the "hollow" the curve wraps around (Norway's around Sweden, Chile's
  across the Andes into Argentina) — confirmed Chile's new centroid had moved the right
  direction but was still, provably, in Argentina. Second pass replaced centroid math entirely
  with `polylabel` (Mapbox's "pole of inaccessibility" algorithm, the standard tool for map
  label placement — added as a real dependency), which operates on the polygon's own ring
  coordinates and is guaranteed to land strictly inside the shape. Verified with the proper
  containment check across all 197 quizzable countries: Chile, Norway, Sweden, and Russia all
  confirmed strictly inside their own polygon now (not just visually plausible). Commits
  `53e24b2`, `4d4782a`.

- **General tap forgiveness, device-width-aware — shipped, with a known remaining limit.** User
  report: "the game needs some forgiveness in general. I got big ass fingers and even just
  missed New Hampshire even though I feel like I clicked right on it." Root cause: every
  invisible tap-padding radius on the map is a fixed number of MAP_VIEWBOX units, not a fixed
  number of screen pixels — the map's CSS width is responsive, so the SAME padding shrinks
  noticeably on a phone-width screen, a gap the earlier Rhode Island fix never accounted for
  (only verified at a desktop-width viewport). Added a live ResizeObserver-based scale factor
  that grows every tap radius back up to the same physical screen size on a narrower device;
  bumped the underlying constants up generally too. Found and fixed two real bugs while
  verifying this on an actual mobile viewport: a genuine overlap regression (New Hampshire's own
  dead-center tap resolving to Vermont, since the scaled-up flat radius reached past its
  neighbor's centroid — fixed with a real per-pair geometric ceiling that accounts for the map's
  own zoom level) and a ResizeObserver that silently never attached at all (a ref-identity/timing
  bug). Verified with an automated sweep of every US state and water body confirming no
  self-swallow anywhere. **Known remaining limit**: New England (New Hampshire/Vermont/
  Massachusetts) is genuinely the tightest-packed corner of the whole map — even with this fix,
  it gets comparatively little extra padding versus a well-separated region, since the safety
  ceiling has to respect how close the real geometry actually is. A future pass could use each
  region's real polygon outline instead of its centroid to measure that ceiling, which would
  likely help this specific cluster; not attempted here. Commit `9de1a37`.

- **Restart-with-confirmation on all three quiz screens — shipped.** User request: "all map
  modes need a restart button with confirmation." The countries quiz already had this; the
  US-states and seas/oceans quizzes didn't. Both wired up to `useGenericQuiz`'s existing
  `playAgain()`, same header button + `ConfirmDialog` pattern the countries quiz already uses.
  Commit `9469ff4`.

- **Countries quiz auto-zooms to the selected continent(s) — shipped.** User request: "if the
  user chooses to test on a continent, it would be nice to focus in on the continent
  automatically like we did for the american quiz." WorldMap gained `focusBounds` (a
  `[x0,y0,x1,y1]` box that derives both the center point AND the zoom level, unlike
  `focusCountryId`'s fixed scale — how far to zoom depends on how big the region is);
  `geo.ts`'s new `getContinentBounds()` computes it from every quizzable country's centroid in
  the selected continent(s). 'all' continents keeps the whole-world view. Found and fixed a real
  conflict along the way: typeIt/multipleChoice+country/continent modes already re-focus tightly
  on each question's own country every question — with a continent filter active, that was
  overriding the continent-wide view after question 1. Fixed by only using the per-question
  focus when no continent filter is active. Verified via live screenshots (South America,
  Europe, a combined Europe+Asia selection, and the typeIt conflict resolved). Commit `088d2b8`.

- **Rhode Island (and every small US state/water body) too small to tap — fixed.** User report:
  "rhode island is too small to click on." Verified directly — RI's real shape is only ~10x14px
  at the states quiz's normal zoom, and a miss of as little as 4-8px already fell through to
  Connecticut or Massachusetts. Gave every region (not just tiny countries, which already had
  this) a constant-screen-size invisible tap-padding circle at its centroid, rendered ON TOP of
  every region's real shape (not underneath, unlike the tiny-country markers' version — real,
  non-overlapping adjacent polygons have no z-order ambiguity for an underneath circle to
  resolve, so it has to actually intercept a near-miss that lands inside a neighbor's real
  territory). Verified RI's real hit margin went from 3-7px to ~17-18px in every direction, and
  that a genuine "Find: Rhode Island" question now accepts a deliberate 10px near-miss. Commit
  `eb8c0a9`.

- **US-states auto-zoom, seas/oceans land/water contrast, quiz-picker tabs, and dropping the
  dot/marker fallback — shipped.** A 6-item request in one batch: (1) the US-states quiz now
  opens already zoomed to the US (`focusCountryId`/`focusScale` on WorldMap); (2) the seas/oceans
  map recolors land solid gray and non-interactive so water reads as clearly distinct blue at a
  glance; (3) "Start a quiz" on the home screen now opens a 3-tab picker (Countries/US
  states/Seas & oceans) instead of separate cards you had to scroll to find; (4) the old
  "Dots only / With borders" marker system was removed entirely — every consumer (both quizzes,
  the mastery map) now taps real region polygons unconditionally, with tap accuracy identical
  either way; (5) in its place, a "Show outlines / Hide until answered" toggle controls only
  whether the border stroke is visible before answering — an answered region's real border (and
  flag stamp) always reveals itself regardless. Bug found and fixed along the way:
  `.world-map__region`'s CSS class had a hardcoded stroke color that silently outranked whatever
  `regionStrokeFor` returned (a CSS stylesheet rule always beats an SVG presentation attribute) —
  every region rendered with a visible border, including in "hidden" mode, no matter what the
  toggle said. Fixed by dropping the CSS color and requiring every WorldMap caller to pass its own
  `regionStrokeFor` explicitly. Verified via live Playwright screenshots (fully seamless hidden
  map, correct reveal-on-answer, all three consumers). Commit `1763f46`.

- **All 197 country flags converted from emoji to real SVG images — shipped.** Same fix already
  applied to US states, now for countries: Unicode regional-indicator flag emoji don't render on
  every platform — Windows/Chrome shows the two-letter country code as text instead, which turned
  out to affect the United States' own flag, not just small/obscure ones. Sourced all 197 real
  flag SVGs from the `flag-icons` npm package (MIT), joined to this app's ISO-numeric country ids
  via `world-countries`' ccn3 field (both temporary, `--no-save` dev-time sources, already
  uninstalled — see `public/data/flags/countries/SOURCE.md` to regenerate). Every render site that
  used `CountryDef.flagEmoji` now renders a real image instead: the flags-category quiz prompt,
  the map's per-country flag stamp after answering, the lookup/atlas screen, the daily challenge,
  and the post-quiz review map. Commit `756aa4a`.

- **Seas/oceans + US-states quizzes: sync, personal-bests, and mastery-map integration —
  shipped.** Both quizzes launched local-only for miss-tracking (see their own entries below);
  the user asked to close that gap before the next deploy rather than ship it partial, wanting
  everything bundled into one push (limited monthly deploy budget). `SyncDoc` gained
  `waterBodyStats`/`waterBodyHistory`/`usStateStats`/`usStateHistory` (optional, same
  field-absent-means-no-info-yet rule as `dailyChallenge`); the "clear my stats & history" reset
  now covers all three quiz universes, not just countries. `useGenericQuiz.ts` became a pure,
  externally-controlled session stepper instead of owning its own localStorage — `useQuiz.ts`
  calls it twice and is the one place that actually persists/syncs, same reasoning as the daily
  streak's centralization. `MasteryScreen` gained a Countries/Seas & oceans/US states tab
  (the two new universes render as colored marker dots, same as their own quiz screens, since
  there's no boundary geometry to fill in); `RecordsScreen` gained a section per universe.
  Found and fixed along the way: the US-states quiz's category picker (name/flag/capital) never
  actually reached `quiz.start()` — it silently stayed hard-defaulted to `'name'` no matter what
  was picked, which the UI itself never revealed since the prompt display used a separate local
  variable. Verified live against the real Firestore project: device A played full sessions in
  all three configs (seas/oceans, US-states by name, US-states by capital) to completion,
  confirmed the capitals run actually recorded `category: 'capital'` (not `'name'`), then device
  B — which never played anything — saw the exact same records and mastery-map coloring the
  moment it connected, and both devices ended up with all three universes' records cleared after
  running the reset. Commit `657b66a`.

- **Daily Challenge streak now syncs across devices — fixed.** `useDailyChallenge.ts` used to
  read/write only `localStorage` directly, never touching the sync pipeline personal bests and
  weak-spots history already go through — playing the daily challenge on one device tracked a
  completely separate streak from every other device on the same sync code. Folded
  `lastPlayedDateKey`/`lastPlayedCorrect`/`streak` into the same `SyncDoc` `stats`/`history`
  already live in (`network/sync.ts`'s new optional `dailyChallenge` field — optional so a doc
  written before this shipped still deserializes fine, with every reader treating "field absent"
  as "no info yet," never as "field present and empty"), reusing `createSyncCode`/
  `connectToSyncCode`'s existing seed/merge flow. Merging two independently-grown streaks (the
  one-time fold-in when a device connects) isn't a "combine the numbers" case like stats/history
  — whichever device most recently actually played is simply authoritative
  (`mergeDailyChallengeState`, verified against 5 cases before trusting it live). `resetSyncDoc`
  (the "clear my stats & history" feature) switched from a full-document replace to
  `{ merge: true }` so it can't silently wipe the streak as a side effect of its payload simply
  not mentioning it — the reset button was always scoped to stats/history, never the streak.
  Centralized in `useQuiz.ts` (`completeDailyChallenge`) instead of the old separate hook, since
  `useQuiz` already owns the one live Firestore subscription everything else goes through;
  `useDailyChallenge.ts` is removed, `DailyChallengeScreen`/`HomeScreen` now take the state as
  props from `App.tsx`. Verified live against the real Firestore project (not just reasoning
  about the diff): a Playwright script drove two separate browser contexts end to end — device A
  plays today's challenge and starts syncing, device B (which never plays anything itself) shows
  the correct "done today, 1-day streak" the moment it connects, and after device A runs "Clear
  my stats & history," both devices still show the streak intact. Commit `4b12e84`.

- **Seas and oceans quiz — shipped.** Find/name bodies of water (5 oceans + 15 major seas), the
  water equivalent of the country quiz. The open question flagged here — seas nest inside oceans
  and have fuzzy, conventional boundaries, so the exact `WorldMap` country-tap model might not
  port over — was resolved with the user rather than guessed: each body is a hand-picked
  open-water marker point (reusing the tiny-country marker/adaptive-tap-radius machinery already
  in `geo.ts`), not a claimed real boundary polygon, which sidesteps the nesting problem entirely
  since points don't overlap the way polygons would. New shared engine infra
  (`genericSession.ts`) generic over any `{id, name, aliases?}` item, reused by the US-states quiz
  below. `WaterBodyQuizScreen.tsx`, self-contained (setup → play → summary) rather than reusing
  the country quiz's screens, whose config surface is much bigger than this quiz needs. Shipped
  local-only for miss-tracking at first (no sync/personal-bests/mastery-map integration); the user
  asked for that closed out before the next deploy, so it was — see the sync/personal-bests/
  mastery-map entry below, done the same day. Verified with a live Playwright smoke test against
  the running app (screenshots + a real answer-flow click-through), which caught a real bug the
  build/typecheck couldn't: `WorldMap`'s tiny-country dots (Vatican City, Nauru, ...) and
  microstate insets were rendering unconditionally underneath the new water-body markers, visually
  indistinguishable from the real targets — fixed with a new `showCountryMarkers` flag. Commit
  `8f6ad4e`. The "no real boundary source exists" half of the original nesting reasoning turned
  out to be wrong: the user asked for click-anywhere borders here too (after the same ask for US
  states), and Natural Earth's marine-polygons layer has all 20 bodies as named polygons that are
  a genuine non-overlapping tessellation — verified directly (point-in-polygon script) before
  trusting it, so the nesting concern doesn't actually block real borders after all. Same "Map
  style" toggle (With borders / Dots only, defaults to borders) as the US-states quiz now, built
  on the same shared `MapRegion` plumbing. Caught and fixed a real d3-geo rendering artifact along
  the way (a solid blob in open mid-Atlantic water, traced to ~25 tiny holes in North Atlantic
  Ocean's real shape that d3-geo's adaptive resampling mis-projected to span nearly the whole
  map) — see the commit for the full diagnosis. Commit `9316a03`.

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
  `UsStatesQuizScreen.tsx`, `usStates.ts`. Same scope boundary as seas/oceans at first (local-only
  miss-tracking, no sync/records/mastery-map) — closed the same day, see the entry below. Verified
  live (Playwright): state
  markers cluster correctly over the US (dense in New England, Alaska/Hawaii correctly far afield),
  the flag category renders a real, correct SVG (spot-checked against Alabama/Texas/Colorado/New
  Mexico's actual flags), and a full answer round-trip works. Commit `1b71e6e`. One more parity
  gap closed after the user asked directly whether it carried over: the country quiz stamps a
  country's flag on the map once it's answered (see that Done entry below) — states had no
  equivalent at first, since `WorldMap`'s existing flag-stamping is Unicode-emoji-only and states
  use real image files. Added a parallel `markerImageFor` (an SVG `<image>` instead of `<text>`)
  and wired it in with the same rules (skip for the 'flag' category itself, since that's already
  the prompt). Commit `cb3c3e3`. Then the user asked for real state borders (or an "on/off"
  option) plus a skip button on this quiz and seas/oceans — the marker-dot approach above was
  deliberate at the time (no boundary geometry existed in the bundled data at all), not a final
  call against real borders, so once asked, sourced `us-atlas`'s `states-10m.json` (raw, not
  Albers-projected, so it works with this app's own projection) as real US-state boundary data —
  see `public/data/us-states-10m.json.SOURCE.md`. `UsStatesQuizScreen` now has a "Map style"
  toggle (With borders / Dots only, defaults to borders, remembered in `localStorage`) between
  real bordered/tappable state shapes (`WorldMap`'s new `regions` layer) and the original marker
  dots. Skip (`genericSession.ts` already had it plumbed through, just never had a button) added
  to both this quiz and seas/oceans. Verified live: 50 real state shapes render and score
  correctly on a direct tap (no marker/precomputed-coordinate involved at all), toggling swaps
  cleanly between the two rendering modes, the choice survives a reload, and skip actually
  advances the question in both quizzes. Commit `42a6113`.

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
