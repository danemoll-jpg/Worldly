# Seas/oceans boundary source

`water-body-regions.json` is a filtered subset (22 of 306 features — just the ones matching
`waterBodies.ts`'s 20 quizzed bodies, with the Pacific/Atlantic split into their North/South
halves — see `geo.ts`'s `WATER_BODY_SOURCE_NAMES`) of Natural Earth's `10m Geography Marine
Polys` layer (the same public-domain dataset family `countries-10m.json`/`us-states-10m.json`
come from — Natural Earth is explicit that no permission or attribution is required to use it),
fetched from the `nvkelso/natural-earth-vector` GitHub mirror (a standard, widely-used pre-built
GeoJSON conversion of Natural Earth's shapefiles, maintained by one of Natural Earth's original
data curators) on 2026-08-26:

  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson

Plain GeoJSON, not topojson — small enough already (~400KB) after filtering that arc-sharing
compression wasn't worth the extra build step, unlike the two topojson files (`countries-10m.json`,
`us-states-10m.json`), which start much larger and DO share borders across many adjacent shapes.

This resolved the exact question BACKLOG.md's seas/oceans entry originally raised — whether real,
tappable region boundaries were even possible given seas nest inside oceans (Mediterranean is
part of the Atlantic) with no hard edges: verified directly (a standalone point-in-polygon script,
same method used elsewhere in this project to verify map data) that these named polygons are
genuinely non-overlapping — a point inside the Mediterranean Sea polygon is NOT also inside the
Atlantic Ocean polygon next to it. Natural Earth's marine-polygon layer is a real, edited
tessellation of the ocean by name, not just an approximate/fuzzy label region, so the original
"nesting is unresolvable, use marker points instead" conclusion no longer holds now that this
specific dataset was found.
