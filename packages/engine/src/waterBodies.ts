// Oceans and major seas for the "seas and oceans" quiz — the water equivalent of countries.ts,
// but deliberately a much smaller, simpler shape: no continent, no capitals/languages. Unlike
// countries, ocean/sea boundaries are conventional and fuzzy rather than hard-edged in everyday
// understanding (a sea is "part of" the ocean it opens into — the Mediterranean nests inside the
// Atlantic, the Baltic inside the Atlantic via the North Sea, ...), which first read as
// unresolvable without a real geometry source: `lon`/`lat` here are a hand-picked open-water
// coordinate per body — not a claimed precise boundary, just a findable point roughly at its
// center — reusing the same marker/adaptive-tap-radius approach `geo.ts` built for tiny
// countries (Vatican City, Nauru, ...), still used as the client's "dots only" map-style option
// and as every region's on-map centroid regardless of which style is picked.
//
// Real per-body boundary polygons turned out to exist after all (see the client's
// water-body-regions.json.SOURCE.md, sourced from Natural Earth's marine-polygons layer) —
// verified directly that they're a genuine non-overlapping tessellation by name, not a fuzzy
// approximation, so the nesting problem above doesn't actually block real borders; that's the
// client's "with borders" map-style option (the default), joined against these entries by name
// (`geo.ts`'s WATER_BODY_SOURCE_NAMES).
//
// `lon`/`lat` are plain WGS84 degrees, hand-picked to fall on open water clear of coastlines —
// verified against the same projected map the country quiz uses (see the client's geo.ts).
export type WaterBodyKind = 'ocean' | 'sea';

export interface WaterBodyDef {
  id: string;
  name: string;
  kind: WaterBodyKind;
  lon: number;
  lat: number;
}

export const WATER_BODIES: WaterBodyDef[] = [
  // The 5 oceans.
  { id: 'pacific-ocean', name: 'Pacific Ocean', kind: 'ocean', lon: -130, lat: 0 },
  { id: 'atlantic-ocean', name: 'Atlantic Ocean', kind: 'ocean', lon: -35, lat: 10 },
  { id: 'indian-ocean', name: 'Indian Ocean', kind: 'ocean', lon: 75, lat: -20 },
  { id: 'southern-ocean', name: 'Southern Ocean', kind: 'ocean', lon: 20, lat: -65 },
  { id: 'arctic-ocean', name: 'Arctic Ocean', kind: 'ocean', lon: 0, lat: 84 },

  // Major seas and gulfs, roughly ordered by region.
  { id: 'mediterranean-sea', name: 'Mediterranean Sea', kind: 'sea', lon: 18, lat: 35 },
  { id: 'black-sea', name: 'Black Sea', kind: 'sea', lon: 34, lat: 43 },
  { id: 'north-sea', name: 'North Sea', kind: 'sea', lon: 3, lat: 56 },
  { id: 'baltic-sea', name: 'Baltic Sea', kind: 'sea', lon: 19, lat: 58 },
  { id: 'red-sea', name: 'Red Sea', kind: 'sea', lon: 38, lat: 20 },
  { id: 'persian-gulf', name: 'Persian Gulf', kind: 'sea', lon: 51, lat: 27 },
  { id: 'arabian-sea', name: 'Arabian Sea', kind: 'sea', lon: 65, lat: 15 },
  { id: 'caribbean-sea', name: 'Caribbean Sea', kind: 'sea', lon: -75, lat: 15 },
  { id: 'gulf-of-mexico', name: 'Gulf of Mexico', kind: 'sea', lon: -90, lat: 25 },
  { id: 'bering-sea', name: 'Bering Sea', kind: 'sea', lon: -175, lat: 59 },
  { id: 'sea-of-japan', name: 'Sea of Japan', kind: 'sea', lon: 135, lat: 40 },
  { id: 'yellow-sea', name: 'Yellow Sea', kind: 'sea', lon: 123, lat: 36 },
  { id: 'south-china-sea', name: 'South China Sea', kind: 'sea', lon: 114, lat: 12 },
  { id: 'coral-sea', name: 'Coral Sea', kind: 'sea', lon: 155, lat: -15 },
  { id: 'caspian-sea', name: 'Caspian Sea', kind: 'sea', lon: 51, lat: 42 },
];

export const WATER_BODY_BY_ID: Record<string, WaterBodyDef> = Object.fromEntries(WATER_BODIES.map((w) => [w.id, w]));
