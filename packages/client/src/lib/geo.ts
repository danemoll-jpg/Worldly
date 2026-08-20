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
  /** True for countries whose real shape is impractical to see or reliably tap at typical zoom
   * levels (Vatican City, Liechtenstein, Monaco, Nauru, ...). When `insetGroupId` is null,
   * WorldMap draws a small, constant-screen-size marker on top of these so they're always
   * findable regardless of zoom; when it's set, the inset box is the intended way to find this
   * country instead (see `insetGroupId`). */
  isTiny: boolean;
  /** Center point, in MAP_VIEWBOX units, of the feature's largest single piece — where the
   * tiny-country marker gets placed. Meaningless (but harmless) when `isTiny` is false. */
  centroid: [number, number];
  /** How far (in MAP_VIEWBOX units) from `centroid` a tap should still count as hitting this
   * marker — a forgiving hit area for real fingers, well beyond the marker's visible dot.
   * Adaptive per-country: capped at half the distance to the nearest other marker-rendering tiny
   * country so two markers' hit areas never swallow each other. Meaningless when `isTiny` is
   * false or `insetGroupId` is set (that country has no marker on the main map at all). */
  tapRadius: number;
  /** Set for tiny countries that sit close enough to OTHER tiny countries that no marker radius
   * can disambiguate a tap between them on the main map at all (Vatican City is only ~6 units
   * from San Marino; several Caribbean island states are under 3 units apart from each other —
   * for scale, the whole map is 960 units wide). These render with no marker on the main map;
   * instead WorldMap draws a small separate zoomed-in inset box (id/label from INSET_GROUPS)
   * where the same countries have real, comfortably-sized, unambiguous tap targets. */
  insetGroupId: string | null;
}

/** Fixed drawing surface every feature's path is computed against — matches the SVG's own
 * viewBox, so panning/zooming is just a transform on top, never a re-projection. */
export const MAP_VIEWBOX = { width: 960, height: 500 };

/** A country's real on-map size is considered "tiny" (see MapFeature.isTiny) when its largest
 * single piece is smaller than this in both dimensions, in MAP_VIEWBOX units. Calibrated
 * against the actual projected data: this comfortably covers everything from Vatican City
 * (~0.005 units) up through island nations like Samoa and Comoros (~1.7-1.8 units), while
 * excluding ordinary small-but-visible countries like Luxembourg (~2.2 units) — there's a clear
 * gap in the real distribution right around here, not an arbitrary round number. */
const TINY_PRIMARY_DIMENSION = 2.2;

/** Bounds on the adaptive tap radius (see MapFeature.tapRadius): MIN is deliberately bigger
 * than the marker's own visible-dot radius (see WorldMap.tsx) — a hit radius smaller than the
 * dot itself would add nothing, since the dot already sits on top and catches those taps. MAX
 * keeps an isolated tiny country (nothing else tiny anywhere nearby) from grabbing an
 * unreasonably large chunk of the map. */
const MIN_TAP_RADIUS = 7;
const MAX_TAP_RADIUS = 12;
/** Small gap kept between two neighboring tap circles at their half-distance split, so they
 * never exactly touch (avoids a razor's-edge boundary where the two are indistinguishable). */
const TAP_RADIUS_MARGIN = 0.5;

/** Clusters of tiny countries close enough together that no marker radius can tell taps apart
 * between them on the main map — each gets its own small, zoomed-in inset box instead (see
 * WorldMap.tsx), the same fix atlases and other geography references use for exactly this
 * problem. `viewBox` is deliberately shaped to each cluster's real aspect ratio (the Caribbean
 * chain runs north-south; the European microstates run east-west), not a generic square. */
export const INSET_GROUPS: { id: string; label: string; countryIds: string[]; viewBox: { width: number; height: number } }[] = [
  {
    id: 'europe-microstates',
    label: 'Europe microstates',
    countryIds: ['438', '336', '674', '492', '020'], // Liechtenstein, Vatican City, San Marino, Monaco, Andorra
    viewBox: { width: 200, height: 100 },
  },
  {
    id: 'caribbean-states',
    label: 'Eastern Caribbean',
    countryIds: ['028', '052', '212', '308', '662', '659', '670'], // Antigua & Barbuda, Barbados, Dominica, Grenada, Saint Lucia, St Kitts & Nevis, St Vincent & the Grenadines
    viewBox: { width: 110, height: 180 },
  },
];

const INSET_GROUP_BY_COUNTRY_ID = new Map<string, string>(INSET_GROUPS.flatMap((g) => g.countryIds.map((id) => [id, g.id] as const)));

/** Margin (in the inset's own viewBox units) kept between the fitted shapes and the box edge. */
const INSET_MARGIN = 14;

export interface InsetFeature {
  id: string;
  /** Position, in the inset's own viewBox units, to draw a fixed-size dot at — NOT a to-scale
   * outline (see buildInset's comment for why). */
  cx: number;
  cy: number;
}

export interface Inset {
  id: string;
  label: string;
  viewBox: { width: number; height: number };
  features: InsetFeature[];
}

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

type Bounds = [number, number, number, number]; // [minX, minY, maxX, maxY]

interface ProjectedFeature {
  path: string;
  /** Bounds of the largest single ring/piece (by area) — for a one-piece country this is just
   * its whole shape; for an archipelago (Tuvalu, Marshall Islands, ...) this deliberately does
   * NOT span the full scattered extent, since "how big does the biggest island look" is what
   * actually determines whether it's findable, not how far apart the islands are. */
  primaryBounds: Bounds | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function projectFeature(f: any, pathGenerator: ReturnType<typeof geoPath>): ProjectedFeature {
  if (f.geometry?.type !== 'MultiPolygon') {
    const d = pathGenerator(f) ?? '';
    if (!d) return { path: '', primaryBounds: null };
    const b = pathGenerator.bounds(f);
    return { path: d, primaryBounds: [b[0][0], b[0][1], b[1][0], b[1][1]] };
  }

  const pieces: string[] = [];
  let primary: { bounds: Bounds; area: number } | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const polygonCoords of f.geometry.coordinates as any[]) {
    const ringFeature = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: polygonCoords } };
    const bounds = pathGenerator.bounds(ringFeature);
    const width = bounds[1][0] - bounds[0][0];
    const height = bounds[1][1] - bounds[0][1];
    if (width > MAX_PLAUSIBLE_RING_WIDTH && height > MAX_PLAUSIBLE_RING_HEIGHT) continue; // drop the artifact
    const d = pathGenerator(ringFeature);
    if (!d) continue;
    pieces.push(d);
    const area = width * height;
    if (!primary || area > primary.area) {
      primary = { bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]], area };
    }
  }
  return { path: pieces.join(' '), primaryBounds: primary?.bounds ?? null };
}

/** Builds one inset: a small projection fitted to this cluster's own countries, positioning
 * each one accurately relative to the others — but drawn as a fixed-size dot, NOT its real
 * to-scale outline. The clusters this exists for have huge internal size disparity (Andorra is
 * roughly 1000x the area of Vatican City) — fitting a shared scale to the whole group still
 * leaves the smallest members sub-pixel, so scaling up doesn't actually solve the problem it's
 * meant to solve. Real-position dots sidestep that entirely: every member gets an equally
 * tappable target regardless of its true size, while still sitting in roughly the right spot
 * relative to its neighbors. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildInset(group: (typeof INSET_GROUPS)[number], geojson: any): Inset {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupFeatures = geojson.features.filter((f: any) => group.countryIds.includes(f.id));
  const fc = { type: 'FeatureCollection' as const, features: groupFeatures };
  const { width, height } = group.viewBox;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [INSET_MARGIN, INSET_MARGIN],
      [width - INSET_MARGIN, height - INSET_MARGIN],
    ],
    fc,
  );
  const pathGenerator = geoPath(projection);
  return {
    id: group.id,
    label: group.label,
    viewBox: group.viewBox,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    features: groupFeatures.map((f: any) => {
      const [cx, cy] = pathGenerator.centroid(f);
      return { id: f.id as string, cx, cy };
    }),
  };
}

interface MapData {
  features: MapFeature[];
  insets: Inset[];
}

let cachedPromise: Promise<MapData> | null = null;

async function loadMapData(): Promise<MapData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/countries-10m.json`);
  if (!response.ok) throw new Error(`Failed to load map data (${response.status})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topology = (await response.json()) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geojson = feature(topology, topology.objects.countries) as any;
  const projection = geoNaturalEarth1().fitSize([MAP_VIEWBOX.width, MAP_VIEWBOX.height], geojson);
  const pathGenerator = geoPath(projection);

  interface Raw {
    id: string;
    name: string;
    quizzable: boolean;
    path: string;
    primaryBounds: Bounds | null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: Raw[] = geojson.features.map((f: any) => {
    const rawId = (f.id as string | undefined) || slugify(f.properties.name as string);
    const quizCountry = COUNTRY_BY_ID[rawId];
    const { path, primaryBounds } = projectFeature(f, pathGenerator);
    return {
      id: rawId,
      name: quizCountry ? quizCountry.name : (f.properties.name as string),
      quizzable: !!quizCountry,
      path,
      primaryBounds,
    };
  });

  // A handful of ids are shared by more than one feature in the raw data — e.g. Australia's
  // ISO code also tags a tiny external territory (Ashmore and Cartier Islands) as a separate
  // feature. Deciding "is this id tiny" per-feature would wrongly mark the real, huge country
  // as tiny just because one of its minor same-id pieces is small. So: an id only counts as
  // tiny if EVERY feature carrying it is tiny.
  const maxDimensionById = new Map<string, number>();
  for (const r of raw) {
    if (!r.primaryBounds) continue;
    const [x0, y0, x1, y1] = r.primaryBounds;
    const dimension = Math.max(x1 - x0, y1 - y0);
    maxDimensionById.set(r.id, Math.max(maxDimensionById.get(r.id) ?? 0, dimension));
  }

  const withCentroids = raw.map((r) => {
    const groupDimension = maxDimensionById.get(r.id) ?? Infinity;
    const centroid: [number, number] = r.primaryBounds
      ? [(r.primaryBounds[0] + r.primaryBounds[2]) / 2, (r.primaryBounds[1] + r.primaryBounds[3]) / 2]
      : [0, 0];
    return { ...r, centroid, isTiny: r.quizzable && groupDimension < TINY_PRIMARY_DIMENSION };
  });

  // Adaptive tap radius: for each tiny country that still gets a marker on the main map (i.e.
  // NOT covered by an inset — those have no marker at all, see INSET_GROUPS), find the nearest
  // OTHER marker-rendering tiny country and cap this one's hit radius at half that distance
  // (minus a small margin), so two nearby markers' tap areas never overlap and steal each
  // other's taps. Only a couple dozen countries end up tiny, so this O(n²) pass is trivial.
  const markerCentroids = withCentroids
    .filter((f) => f.isTiny && !INSET_GROUP_BY_COUNTRY_ID.has(f.id))
    .map((f) => ({ id: f.id, centroid: f.centroid }));
  function tapRadiusFor(id: string, centroid: [number, number]): number {
    let nearestDistance = Infinity;
    for (const other of markerCentroids) {
      if (other.id === id) continue;
      const dx = other.centroid[0] - centroid[0];
      const dy = other.centroid[1] - centroid[1];
      nearestDistance = Math.min(nearestDistance, Math.hypot(dx, dy));
    }
    const halfGap = nearestDistance / 2 - TAP_RADIUS_MARGIN;
    return Math.min(MAX_TAP_RADIUS, Math.max(MIN_TAP_RADIUS, halfGap));
  }

  const features = withCentroids.map((f): MapFeature => {
    const insetGroupId = INSET_GROUP_BY_COUNTRY_ID.get(f.id) ?? null;
    return {
      id: f.id,
      name: f.name,
      quizzable: f.quizzable,
      path: f.path,
      isTiny: f.isTiny,
      centroid: f.centroid,
      tapRadius: f.isTiny && !insetGroupId ? tapRadiusFor(f.id, f.centroid) : 0,
      insetGroupId,
    };
  });

  const insets = INSET_GROUPS.map((group) => buildInset(group, geojson));

  return { features, insets };
}

function loadMapDataCached(): Promise<MapData> {
  if (!cachedPromise) cachedPromise = loadMapData();
  return cachedPromise;
}

/** Fetches + projects the map once and caches the result for the lifetime of the page — every
 * caller (quiz, lookup, mastery map) shares the same promise instead of re-fetching. */
export function getMapFeatures(): Promise<MapFeature[]> {
  return loadMapDataCached().then((d) => d.features);
}

/** The small zoomed-in cluster boxes (see INSET_GROUPS) — shares the same cached load as
 * getMapFeatures, just a different slice of the result. */
export function getInsets(): Promise<Inset[]> {
  return loadMapDataCached().then((d) => d.insets);
}
