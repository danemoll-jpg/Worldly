// The 50 US states for the "US states" quiz — a distinct quiz universe, parallel to but separate
// from the country quiz (see types.ts's QuizConfig, which this deliberately does NOT reuse: no
// continent to filter by, and `id` here is a USPS two-letter postal code, not the ISO-numeric
// codes countries.ts uses). Washington DC and the territories (Puerto Rico, Guam, ...) are
// deliberately excluded — the backlog item that asked for this is scoped to "50 states."
//
// `countries-10m.json` has the USA as a single country-level shape, not broken into states, so
// `lon`/`lat` here are each state's capital coordinates — originally the ONLY way to place a
// state on the map at all (a findable marker point, same marker/tap-radius approach as
// waterBodies.ts and the tiny-country markers in geo.ts); still used as the client's "dots only"
// map-style option and as every state's on-map marker centroid regardless of which style is
// picked. Real per-state boundary polygons (`us-atlas`'s states-10m.json — see the client's
// us-states-10m.json.SOURCE.md) were sourced afterward and are the client's "with borders"
// map-style option (the default), joined against these entries by state name.
//
// `capital` is the seat of state government (always a single city — unlike a few countries in
// countries.ts, no US state has more than one). Flag images are NOT part of this file — the
// engine stays asset-free (see this package's own framing in types.ts); the client resolves a
// state's flag from its `id` against a static file (see packages/client/public/data/flags/us-states/
// and that folder's SOURCE.md for where the SVGs came from).
export interface UsStateDef {
  id: string;
  name: string;
  capital: string;
  lon: number;
  lat: number;
}

export const US_STATES: UsStateDef[] = [
  { id: 'AL', name: 'Alabama', capital: 'Montgomery', lon: -86.3, lat: 32.37 },
  { id: 'AK', name: 'Alaska', capital: 'Juneau', lon: -134.42, lat: 58.3 },
  { id: 'AZ', name: 'Arizona', capital: 'Phoenix', lon: -112.07, lat: 33.45 },
  { id: 'AR', name: 'Arkansas', capital: 'Little Rock', lon: -92.29, lat: 34.75 },
  { id: 'CA', name: 'California', capital: 'Sacramento', lon: -121.49, lat: 38.58 },
  { id: 'CO', name: 'Colorado', capital: 'Denver', lon: -104.99, lat: 39.74 },
  { id: 'CT', name: 'Connecticut', capital: 'Hartford', lon: -72.68, lat: 41.76 },
  { id: 'DE', name: 'Delaware', capital: 'Dover', lon: -75.52, lat: 39.16 },
  { id: 'FL', name: 'Florida', capital: 'Tallahassee', lon: -84.28, lat: 30.44 },
  { id: 'GA', name: 'Georgia', capital: 'Atlanta', lon: -84.39, lat: 33.75 },
  { id: 'HI', name: 'Hawaii', capital: 'Honolulu', lon: -157.86, lat: 21.31 },
  { id: 'ID', name: 'Idaho', capital: 'Boise', lon: -116.2, lat: 43.62 },
  { id: 'IL', name: 'Illinois', capital: 'Springfield', lon: -89.65, lat: 39.8 },
  { id: 'IN', name: 'Indiana', capital: 'Indianapolis', lon: -86.16, lat: 39.77 },
  { id: 'IA', name: 'Iowa', capital: 'Des Moines', lon: -93.6, lat: 41.59 },
  { id: 'KS', name: 'Kansas', capital: 'Topeka', lon: -95.68, lat: 39.05 },
  { id: 'KY', name: 'Kentucky', capital: 'Frankfort', lon: -84.87, lat: 38.2 },
  { id: 'LA', name: 'Louisiana', capital: 'Baton Rouge', lon: -91.14, lat: 30.45 },
  { id: 'ME', name: 'Maine', capital: 'Augusta', lon: -69.78, lat: 44.31 },
  { id: 'MD', name: 'Maryland', capital: 'Annapolis', lon: -76.49, lat: 38.98 },
  { id: 'MA', name: 'Massachusetts', capital: 'Boston', lon: -71.06, lat: 42.36 },
  { id: 'MI', name: 'Michigan', capital: 'Lansing', lon: -84.56, lat: 42.73 },
  { id: 'MN', name: 'Minnesota', capital: 'Saint Paul', lon: -93.09, lat: 44.95 },
  { id: 'MS', name: 'Mississippi', capital: 'Jackson', lon: -90.18, lat: 32.3 },
  { id: 'MO', name: 'Missouri', capital: 'Jefferson City', lon: -92.17, lat: 38.58 },
  { id: 'MT', name: 'Montana', capital: 'Helena', lon: -112.04, lat: 46.59 },
  { id: 'NE', name: 'Nebraska', capital: 'Lincoln', lon: -96.68, lat: 40.81 },
  { id: 'NV', name: 'Nevada', capital: 'Carson City', lon: -119.77, lat: 39.16 },
  { id: 'NH', name: 'New Hampshire', capital: 'Concord', lon: -71.55, lat: 43.21 },
  { id: 'NJ', name: 'New Jersey', capital: 'Trenton', lon: -74.76, lat: 40.22 },
  { id: 'NM', name: 'New Mexico', capital: 'Santa Fe', lon: -105.94, lat: 35.69 },
  { id: 'NY', name: 'New York', capital: 'Albany', lon: -73.76, lat: 42.65 },
  { id: 'NC', name: 'North Carolina', capital: 'Raleigh', lon: -78.64, lat: 35.78 },
  { id: 'ND', name: 'North Dakota', capital: 'Bismarck', lon: -100.78, lat: 46.81 },
  { id: 'OH', name: 'Ohio', capital: 'Columbus', lon: -82.99, lat: 39.96 },
  { id: 'OK', name: 'Oklahoma', capital: 'Oklahoma City', lon: -97.52, lat: 35.47 },
  { id: 'OR', name: 'Oregon', capital: 'Salem', lon: -123.03, lat: 44.94 },
  { id: 'PA', name: 'Pennsylvania', capital: 'Harrisburg', lon: -76.88, lat: 40.27 },
  { id: 'RI', name: 'Rhode Island', capital: 'Providence', lon: -71.41, lat: 41.82 },
  { id: 'SC', name: 'South Carolina', capital: 'Columbia', lon: -81.03, lat: 34.0 },
  { id: 'SD', name: 'South Dakota', capital: 'Pierre', lon: -100.34, lat: 44.37 },
  { id: 'TN', name: 'Tennessee', capital: 'Nashville', lon: -86.78, lat: 36.16 },
  { id: 'TX', name: 'Texas', capital: 'Austin', lon: -97.74, lat: 30.27 },
  { id: 'UT', name: 'Utah', capital: 'Salt Lake City', lon: -111.89, lat: 40.76 },
  { id: 'VT', name: 'Vermont', capital: 'Montpelier', lon: -72.58, lat: 44.26 },
  { id: 'VA', name: 'Virginia', capital: 'Richmond', lon: -77.44, lat: 37.54 },
  { id: 'WA', name: 'Washington', capital: 'Olympia', lon: -122.9, lat: 47.04 },
  { id: 'WV', name: 'West Virginia', capital: 'Charleston', lon: -81.63, lat: 38.35 },
  { id: 'WI', name: 'Wisconsin', capital: 'Madison', lon: -89.38, lat: 43.07 },
  { id: 'WY', name: 'Wyoming', capital: 'Cheyenne', lon: -104.82, lat: 41.14 },
];

export const US_STATE_BY_ID: Record<string, UsStateDef> = Object.fromEntries(US_STATES.map((s) => [s.id, s]));
