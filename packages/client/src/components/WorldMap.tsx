import { useEffect, useMemo, useRef, useState } from 'react';
import { getInsets, getMapFeatures, Inset, MAP_VIEWBOX, MapFeature, MapRegion } from '../lib/geo';
import { usePanZoom } from '../lib/panZoom';

interface WorldMapProps {
  /** Real, bordered, directly-tappable shapes — the seas/oceans and US-states quizzes' map
   * layer (see MapRegion's doc comment: both started as marker points, before real boundary
   * data was found for each; the marker-dot rendering this component used to also support was
   * removed once every caller had real borders to use instead — no reason to keep a cruder
   * fallback around once nothing needs it). */
  regions?: MapRegion[];
  /** How to color a region's fill — parallel to `fillFor`. Required whenever `regions` is
   * passed. */
  regionFillFor?: (region: MapRegion) => string;
  /** How to color a region's outline — parallel to `regionFillFor`. Defaults to the standard
   * CSS border color when omitted; a caller can return `'transparent'` to hide a specific
   * region's outline (e.g. "don't reveal state borders until this one's been answered" — see
   * UsStatesQuizScreen/WaterBodyQuizScreen's `showOutlines` toggle) without touching its fill or
   * its tappability, which stays driven by the real shape underneath either way. */
  regionStrokeFor?: (region: MapRegion) => string;
  /** Fires for a tap on one of `regions` — parallel to `onCountryTap`. */
  onRegionTap?: (region: MapRegion) => void;
  /** Optional image URL to stamp at a region's centroid, on top of its fill — the region-layer
   * equivalent of `flagFor` below (both render a real bundled SVG image now — see
   * UsStatesQuizScreen's flagSrc / lib/format.ts's countryFlagSrc). Same "learn the flags out of
   * ordinary play" effect, same skip-when-flag-IS-the-prompt rule. */
  regionImageFor?: (region: MapRegion) => string | null;
  /** Whether to draw the tiny-country dot markers and the microstate insets (Vatican City, the
   * Caribbean cluster, ...) on top of the ordinary country shapes. Defaults to true — every
   * existing caller (the country quiz, the mastery map, lookup) wants these. Set to false for a
   * `markers`-only screen (seas/oceans, US states): those tiny-country dots are indistinguishable
   * on sight from the quiz's OWN markers and aren't relevant to a non-country quiz anyway, so
   * left on they'd just be confusing clutter mixed in with the real targets. */
  showCountryMarkers?: boolean;
  /** When true, the ordinary country layer renders with the same non-interactive look/behavior
   * background territories already get (no pointer cursor, no hover brighten) regardless of
   * each country's own `quizzable` flag, and never receives taps even if `onCountryTap` is
   * passed. For a `regions`-only screen (seas/oceans, US states): the country layer there is
   * just backdrop context underneath the real quiz layer, not something to click, and it
   * shouldn't visually invite a tap that would silently do nothing. */
  countryLayerInert?: boolean;
  /** How to color each shape — the caller decides everything (default fill, target
   * highlighted, right/wrong feedback, mastery-map coloring, ...); this component only knows
   * how to draw and how to pan/zoom/tap. */
  fillFor: (feature: MapFeature) => string;
  /** Optional flag image URL to stamp at a shape's centroid, on top of its fill — e.g. QuizScreen
   * shows the answered country's flag once it's been revealed, building a "learn the flags"
   * effect out of ordinary play instead of needing a dedicated mode for it. A real bundled SVG
   * (see lib/format.ts's countryFlagSrc), not the Unicode flag emoji — several platforms,
   * Windows/Chrome included, don't render regional-indicator emoji as flags at all. Return null
   * (or omit this prop entirely) for a feature that shouldn't show one right now. Purely
   * decorative: counter-scaled the same way the tiny-country markers are so it stays a constant,
   * legible size regardless of zoom, and doesn't affect hit-testing at all. */
  flagFor?: (feature: MapFeature) => string | null;
  /** Fires for a genuine tap/click (not the tail end of a pan or pinch) on any shape —
   * including background-only territories; the caller decides whether to act on
   * `feature.quizzable`. Also fires for taps inside an inset box (see geo.ts's INSET_GROUPS). */
  onCountryTap?: (feature: MapFeature) => void;
  /** When set (and changes to a new id), the map auto-pans/zooms to center that country —
   * "quickly see where the thing you're guessing actually is," for quiz modes where the
   * country's identity isn't itself the secret (see QuizScreen's revealsLocationOnMap), or just
   * to start a regional quiz (US states) already zoomed to the right part of the world instead
   * of the whole globe. Purely an initial view: the player can still freely pan/zoom away
   * afterward, same as any other transform change. Ignored (no-op) for an id the map has no
   * feature for. */
  focusCountryId?: string | null;
  /** Zoom level for `focusCountryId` — defaults to AUTO_FOCUS_SCALE (tuned for a single small
   * country against its neighbors). A caller focusing on something physically larger (the USA
   * for the US-states quiz) can pass a gentler scale so the initial view isn't cropped tighter
   * than the thing it's supposed to be showing. */
  focusScale?: number;
  /** Same initial-view idea as `focusCountryId`, but for a region rather than a single country —
   * the countries quiz's continent filter (see QuizScreen/geo.ts's getContinentBounds) uses this
   * to open already zoomed to whichever continent(s) are actually being quizzed, instead of the
   * whole world every time. A `[x0, y0, x1, y1]` box in MAP_VIEWBOX units; both the center point
   * AND the zoom level are derived from it (see panZoom's focusOnBounds), unlike
   * `focusCountryId`/`focusScale`'s fixed scale — how far to zoom naturally depends on how big a
   * region this is. Independent of `focusCountryId`: a caller uses one or the other, never both. */
  focusBounds?: [number, number, number, number] | null;
  className?: string;
}

/** Fixed corner for each inset box, in CSS terms — keyed by inset id so it's obvious at a
 * glance which box goes where without hunting through JSX. */
const INSET_POSITION: Record<string, 'top-left' | 'top-right'> = {
  'europe-microstates': 'top-left',
  'caribbean-states': 'top-right',
};

/** How far to zoom in when auto-focusing on a country — moderate on purpose: enough to make a
 * small country legible and unambiguous among its neighbors, but not so far that it crops away
 * the surrounding context that actually helps you place it (which is the whole point here). */
const AUTO_FOCUS_SCALE = 4;

/** The core reusable map surface — flat, pannable, zoomable (mouse wheel, drag, or two-finger
 * pinch/pan on touch), shared by the quiz screens and the mastery map. Doesn't know anything
 * about quiz state; it's purely "here are shapes, here's how to color them, tell me what got
 * tapped." Map data loads asynchronously (see lib/geo.ts) and is cached after the first load,
 * so every screen after the first shows it instantly. */
export function WorldMap({
  fillFor,
  flagFor,
  onCountryTap,
  countryLayerInert = false,
  regions,
  regionFillFor,
  regionStrokeFor,
  onRegionTap,
  regionImageFor,
  showCountryMarkers = true,
  focusCountryId,
  focusScale,
  focusBounds,
  className,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [features, setFeatures] = useState<MapFeature[] | null>(null);
  const [insets, setInsets] = useState<Inset[]>([]);

  useEffect(() => {
    let cancelled = false;
    getMapFeatures().then((loaded) => {
      if (!cancelled) setFeatures(loaded);
    });
    getInsets().then((loaded) => {
      if (!cancelled) setInsets(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const featureById = useMemo(() => {
    const m = new Map<string, MapFeature>();
    for (const f of features ?? []) m.set(f.id, f);
    return m;
  }, [features]);

  const regionById = useMemo(() => {
    const m = new Map<string, MapRegion>();
    for (const region of regions ?? []) m.set(region.id, region);
    return m;
  }, [regions]);

  function handleTap(target: Element | null) {
    if (!target) return;
    const regionId = target.getAttribute('data-region-id');
    if (regionId !== null) {
      const region = regionById.get(regionId);
      if (region) onRegionTap?.(region);
      return;
    }
    if (countryLayerInert || !onCountryTap || !features) return;
    const indexAttr = target.getAttribute('data-feature-index');
    if (indexAttr === null) return;
    const feature = features[Number(indexAttr)];
    if (feature) onCountryTap(feature);
  }

  const { transform, reset, focusOn, focusOnBounds, handlers } = usePanZoom(svgRef, MAP_VIEWBOX, handleTap);

  useEffect(() => {
    if (!focusCountryId) return;
    const feature = featureById.get(focusCountryId);
    if (!feature) return;
    focusOn({ x: feature.centroid[0], y: feature.centroid[1] }, focusScale ?? AUTO_FOCUS_SCALE);
  }, [focusCountryId, focusScale, featureById, focusOn]);

  useEffect(() => {
    if (!focusBounds) return;
    focusOnBounds(focusBounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBounds?.join(','), focusOnBounds]);

  if (!features) {
    return (
      <div className={['world-map-wrap', 'world-map-wrap--loading', className].filter(Boolean).join(' ')}>
        <span>Loading map…</span>
      </div>
    );
  }

  return (
    <div className={['world-map-wrap', className].filter(Boolean).join(' ')}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        className="world-map"
        role="img"
        aria-label="World map"
        {...handlers}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          {features.map((f, i) => (
            <path
              key={i}
              data-feature-index={i}
              d={f.path}
              fill={fillFor(f)}
              vectorEffect="non-scaling-stroke"
              className={
                f.quizzable && !countryLayerInert ? 'world-map__country' : 'world-map__country world-map__country--bg'
              }
            />
          ))}
          {/* Flags for ordinary (non-tiny) countries — see flagFor's doc comment. Placed at the
              same centroid the tiny-country markers use (a bounding-box center, computed for
              every feature regardless of size, not just tiny ones) and counter-scaled the same
              way so it stays a constant, legible size at any zoom. pointerEvents="none" so it's
              purely decorative — never intercepts the tap meant for the country shape under it.
              Tiny countries are handled separately below, alongside their own marker dot. */}
          {flagFor &&
            features.map((f, i) => {
              if (f.isTiny) return null;
              const flag = flagFor(f);
              if (!flag) return null;
              return (
                <g key={`flag-${i}`} transform={`translate(${f.centroid[0]} ${f.centroid[1]}) scale(${1 / transform.scale})`}>
                  <image href={flag} x={-13} y={-9} width={26} height={18} className="world-map__flag" pointerEvents="none" />
                </g>
              );
            })}
          {/* Tiny, geographically isolated countries (Nauru, Malta, Tuvalu, ...) render as
              slivers or single points at any practical zoom level — a real path click target
              for them would be sub-pixel. Drop a small dot at each one's centroid and counter-
              scale it by 1/transform.scale so it stays a constant, always-tappable size on
              screen regardless of zoom. Tiny countries that sit close to OTHER tiny countries
              (Vatican City/San Marino, the Caribbean cluster) skip this entirely — insetGroupId
              is set for those, and they're found via the inset boxes below instead, since no
              marker radius on the main map could tell them apart from their neighbors. */}
          {showCountryMarkers &&
            features.map((f, i) =>
              f.isTiny && !f.insetGroupId ? (
              <g key={`tiny-${i}`} transform={`translate(${f.centroid[0]} ${f.centroid[1]}) scale(${1 / transform.scale})`}>
                {/* An invisible, much more forgiving tap target layered under the visible dot —
                    at this scale a real fingertip is far wider than the dot itself, so hit-
                    testing only the visible circle meant a near-miss would fall through to
                    whatever bigger country happens to be underneath instead. pointerEvents="all"
                    makes this catch taps despite having no visible fill. */}
                <circle data-feature-index={i} r={f.tapRadius} fill="transparent" pointerEvents="all" />
                <circle
                  data-feature-index={i}
                  r={5}
                  fill={fillFor(f)}
                  className={f.quizzable ? 'world-map__tiny-marker' : 'world-map__tiny-marker world-map__tiny-marker--bg'}
                />
                {/* Offset above the dot rather than on top of it — the dot's own color is still
                    the correct/wrong signal, the flag sits alongside it instead of covering it. */}
                {flagFor && flagFor(f) && (
                  <image href={flagFor(f)!} x={-13} y={-24} width={26} height={18} className="world-map__flag" pointerEvents="none" />
                )}
              </g>
            ) : null,
          )}
          {/* Real, bordered, directly-tappable region shapes (US states or seas/oceans — see
              MapRegion's doc comment in geo.ts). Drawn on top of the flat country layer (which
              still covers the rest of the world for context underneath) rather than replacing
              it. */}
          {regions?.map((region) => (
            <path
              key={region.id}
              data-region-id={region.id}
              d={region.path}
              fill={regionFillFor?.(region) ?? 'var(--map-land)'}
              stroke={regionStrokeFor?.(region)}
              // Several water-body regions carry real holes (an ocean's polygon excludes every
              // separately-named sea/gulf within it, e.g. North Atlantic Ocean's real shape has
              // ~25 holes cut out for the Caribbean, the Gulf of Mexico, and others) — real-world
              // shapefile-derived data doesn't reliably follow the exterior-CCW/hole-CW winding
              // convention SVG's default "nonzero" fill-rule depends on to punch a hole out
              // correctly, so a hole with the "wrong" winding renders solid instead of transparent
              // (verified directly: a hole rendered exactly this way is what a blob sitting in
              // open mid-Atlantic water traced back to). "evenodd" sidesteps the whole problem —
              // it alternates fill state on each boundary crossing regardless of winding
              // direction, so nested holes always subtract correctly either way.
              fillRule="evenodd"
              vectorEffect="non-scaling-stroke"
              className="world-map__region"
            />
          ))}
          {/* Invisible, constant-screen-size tap padding for every region (see
              MapRegion.tapRadius's doc comment) — drawn AFTER (so: on top of, in z-order) every
              region's real shape above, deliberately: real, non-overlapping adjacent polygons
              (Rhode Island sharing a border with Massachusetts/Connecticut) have no ambiguous
              overlap for z-order to resolve on their own, so putting this UNDER the real shapes
              would do nothing for a near-miss that lands squarely inside a neighbor's actual
              territory — verified directly (a tap a few px north of Rhode Island's own shape
              resolved to Massachusetts either way). On top, it intentionally claims a small
              sliver of a tiny region's larger neighbors right at their shared border — the same
              "give the hard-to-hit one a deliberate edge" trade the tiny-country markers already
              make, just without a visible dot this time since a region's real shape already
              carries all the visual weight. Harmless for an ordinary interior tap (a big state's
              own circle sits well inside its own territory, nowhere near any neighbor) and
              affects a region's boundary only within this constant, modest screen radius, not
              its whole shape. Counter-scaled the same way the tiny-country markers are, so this
              stays the same physical size on screen at any zoom level. */}
          {regions?.map((region) => (
            <circle
              key={`region-tap-${region.id}`}
              data-region-id={region.id}
              transform={`translate(${region.centroid[0]} ${region.centroid[1]}) scale(${1 / transform.scale})`}
              r={region.tapRadius}
              fill="transparent"
              pointerEvents="all"
            />
          ))}
          {regions?.map((region) => {
            const image = regionImageFor?.(region);
            if (!image) return null;
            return (
              <g key={`region-img-${region.id}`} transform={`translate(${region.centroid[0]} ${region.centroid[1]}) scale(${1 / transform.scale})`}>
                <image href={image} x={-8} y={-6} width={16} height={11} pointerEvents="none" />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Inset boxes: separate, non-zoomable mini-maps for clusters of tiny countries too close
          together for any marker radius to tell apart on the main map (see geo.ts's
          INSET_GROUPS) — the same fix atlases use for exactly this problem. Each cluster member
          draws as a fixed-size dot at its real relative position rather than a to-scale outline
          — these clusters have huge internal size gaps too (Andorra vs. Vatican City), so even
          a zoomed-in to-scale shape would leave the smallest members sub-pixel again. Where the
          group has real surrounding geography worth showing (contextPaths — see INSET_GROUPS'
          contextBounds), it's drawn underneath as ordinary filled/clickable shapes, same as the
          main map, so the dots sit in visible context instead of a void. */}
      {showCountryMarkers && insets.map((inset) => {
        const position = INSET_POSITION[inset.id] ?? 'top-left';
        const hasContext = inset.contextPaths.length > 0;
        return (
          <div
            key={inset.id}
            className={`world-map__inset world-map__inset--${position}${hasContext ? ' world-map__inset--with-context' : ''}`}
            style={{ aspectRatio: `${inset.viewBox.width} / ${inset.viewBox.height}` }}
          >
            <div className="world-map__inset-label">{inset.label}</div>
            <svg viewBox={`0 0 ${inset.viewBox.width} ${inset.viewBox.height}`} className="world-map__inset-svg">
              {inset.contextPaths.map((contextPath) => {
                const mainFeature = featureById.get(contextPath.id);
                if (!mainFeature) return null;
                return (
                  <path
                    key={contextPath.id}
                    d={contextPath.path}
                    fill={fillFor(mainFeature)}
                    className="world-map__inset-context"
                    onClick={() => onCountryTap?.(mainFeature)}
                  />
                );
              })}
              {inset.features.map((insetFeature) => {
                const mainFeature = featureById.get(insetFeature.id);
                if (!mainFeature) return null;
                return (
                  <g key={insetFeature.id}>
                    {/* Invisible, more forgiving tap target under the visible dot — same idea as
                        the main map's tiny-country markers (see MapFeature.tapRadius): the
                        visible dot alone is too small a target to hit reliably on a touchscreen. */}
                    <circle
                      cx={insetFeature.cx}
                      cy={insetFeature.cy}
                      r={insetFeature.tapRadius}
                      fill="transparent"
                      onClick={() => onCountryTap?.(mainFeature)}
                    />
                    <circle
                      data-country-id={insetFeature.id}
                      cx={insetFeature.cx}
                      cy={insetFeature.cy}
                      r={hasContext ? 4 : 7}
                      fill={fillFor(mainFeature)}
                      className="world-map__inset-country"
                      onClick={() => onCountryTap?.(mainFeature)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}

      <button type="button" className="world-map__reset" onClick={reset} title="Reset pan/zoom">
        ⟲
      </button>
    </div>
  );
}
