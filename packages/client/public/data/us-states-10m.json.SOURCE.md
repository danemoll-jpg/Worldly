# US state boundary source

`us-states-10m.json` is the `states-10m.json` file from the `us-atlas` npm package (v3.0.1,
ISC-licensed, same maintainer/family as `world-atlas` — the source of `countries-10m.json`),
pre-built TopoJSON from the U.S. Census Bureau's public-domain Cartographic Boundary files.
Copied here as a static asset (same "bundle it, fetch at runtime" pattern as
`countries-10m.json` — see `geo.ts`), NOT read from `node_modules` at runtime; `us-atlas` stays a
listed dependency in `package.json` for provenance, matching `world-atlas`'s precedent.

Raw (non-Albers) coordinates deliberately, not `states-albers-10m.json` — this app projects
everything itself through the same `geoNaturalEarth1` projection the country map uses (see
`geo.ts`), so it needs real lon/lat geometry, not a pre-projected Albers USA composite.

56 geometries total (50 states + DC + 5 territories: Puerto Rico, Guam, American Samoa, the
Northern Mariana Islands, the US Virgin Islands) — `geo.ts` filters to just the 50 states quizzed
in `usStates.ts` (@worldly/engine), joined by matching `properties.name` (both use standard state
names, e.g. "North Carolina") rather than the topojson's own FIPS numeric ids, since
`usStates.ts`'s `id` is a USPS postal code (`NC`), already load-bearing (StatsMap keys, synced
history) and not worth introducing a second id scheme just for this join.
