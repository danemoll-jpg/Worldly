// Turns the bundled world boundary data into ready-to-render SVG paths. Public-domain data
// (Natural Earth, via the `world-atlas` package's 10m-resolution file — deliberately the
// highest-detail option that package ships, not the smaller 50m/110m ones, because the
// coarser files quietly drop the smallest states entirely, e.g. Tuvalu — and completeness down
// to the smallest countries is the whole point of this app). See @worldly/engine's
// countries.ts for the curation of which of these shapes are actual quiz questions versus
// background-only territories/dependencies.
//
// Served as a static file (public/data/) and fetched at runtime rather than bundled into the
// JS — at ~3.6MB it would otherwise dominate the JS bundle's parse time; as a separate fetch it
// loads in parallel with the app shell and the browser can cache it independently.
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { COUNTRY_BY_ID } from '@worldly/engine';

export interface MapFeature {
  /** Matches a CountryDef.id (see @worldly/engine) when `quizzable`; otherwise a raw id or a
   * slug derived from the dataset's name for the handful of entries with no id at all. */
  id: string;
  /** Display name — the curated engine name when quizzable, else the raw dataset name (shown
   * only as a tooltip on background territories, never asked about). */
  name: string;
  quizzable: boolean;
  /** Pre-computed SVG path `d` attribute, already projected to MAP_VIEWBOX — nothing about
   * rendering needs to know this came from lat/lon coordinates at all. */
  path: string;
}

/** Fixed drawing surface every feature's path is computed against — matches the SVG's own
 * viewBox, so panning/zooming is just a transform on top, never a re-projection. */
export const MAP_VIEWBOX = { width: 960, height: 500 };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// d3-geo's adaptive resampling occasionally mis-projects one ring of a MultiPolygon that's
// made of many very small, tightly-clustered points (real-world example: Maldives — ~176 tiny
// atoll rings, several only a few hundredths of a degree apart) into a spurious shape that
// covers almost the entire map, painting over every other country underneath it. No real
// single ring legitimately spans this much of the map — even Russia's mainland, the widest
// single landmass on Earth, covers well under half the map's width, and nothing spans anywhere
// near full height (that would mean pole-to-pole). Filtering per-ring by absolute size, rather
// than trusting the whole feature's computed bounds, keeps every legitimate country (including
// very large ones) intact while dropping only this specific class of degenerate artifact.
const MAX_PLAUSIBLE_RING_WIDTH = MAP_VIEWBOX.width * 0.75;
const MAX_PLAUSIBLE_RING_HEIGHT = MAP_VIEWBOX.height * 0.7;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function projectFeaturePath(f: any, pathGenerator: ReturnType<typeof geoPath>): string {
  if (f.geometry?.type !== 'MultiPolygon') {
    return pathGenerator(f) ?? '';
  }

  const pieces: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const polygonCoords of f.geometry.coordinates as any[]) {
    const ringFeature = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: polygonCoords } };
    const bounds = pathGenerator.bounds(ringFeature);
    const width = bounds[1][0] - bounds[0][0];
    const height = bounds[1][1] - bounds[0][1];
    if (width > MAX_PLAUSIBLE_RING_WIDTH && height > MAX_PLAUSIBLE_RING_HEIGHT) continue; // drop the artifact
    const d = pathGenerator(ringFeature);
    if (d) pieces.push(d);
  }
  return pieces.join(' ');
}

let cachedPromise: Promise<MapFeature[]> | null = null;

async function loadMapFeatures(): Promise<MapFeature[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/countries-10m.json`);
  if (!response.ok) throw new Error(`Failed to load map data (${response.status})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topology = (await response.json()) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geojson = feature(topology, topology.objects.countries) as any;
  const projection = geoNaturalEarth1().fitSize([MAP_VIEWBOX.width, MAP_VIEWBOX.height], geojson);
  const pathGenerator = geoPath(projection);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return geojson.features.map((f: any) => {
    const rawId = (f.id as string | undefined) || slugify(f.properties.name as string);
    const quizCountry = COUNTRY_BY_ID[rawId];
    return {
      id: rawId,
      name: quizCountry ? quizCountry.name : (f.properties.name as string),
      quizzable: !!quizCountry,
      path: projectFeaturePath(f, pathGenerator),
    };
  });
}

/** Fetches + projects the map once and caches the result for the lifetime of the page — every
 * caller (quiz, lookup, mastery map) shares the same promise instead of re-fetching. */
export function getMapFeatures(): Promise<MapFeature[]> {
  if (!cachedPromise) cachedPromise = loadMapFeatures();
  return cachedPromise;
}
