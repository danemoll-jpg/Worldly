import { useEffect, useMemo, useRef, useState } from 'react';
import { getInsets, getMapFeatures, Inset, MAP_VIEWBOX, MapFeature, PointMarker } from '../lib/geo';
import { usePanZoom } from '../lib/panZoom';

interface WorldMapProps {
  /** Findable point markers with no underlying country shape — the seas/oceans and US-states
   * quizzes (see PointMarker's doc comment for why they're points, not polygons). Renders on top
   * of the ordinary country layer using the exact same constant-on-screen-size, adaptive-tap-
   * radius approach as the tiny-country markers below (counter-scaled against zoom). Omit
   * entirely for the country quiz, which has no use for this layer. */
  markers?: PointMarker[];
  /** How to color/label a marker's visible dot — parallel to `fillFor`, just for `markers`
   * instead of country shapes. Required whenever `markers` is passed. */
  markerFillFor?: (marker: PointMarker) => string;
  /** Fires for a tap on one of `markers` — parallel to `onCountryTap`. */
  onMarkerTap?: (marker: PointMarker) => void;
  /** Optional image URL to stamp above an answered marker, on top of its fill — the US-states
   * quiz's equivalent of `flagFor` below (countries stamp a Unicode flag emoji; states have no
   * such codepoint, so this is a real image instead — see UsStatesQuizScreen's flagSrc). Same
   * "learn the flags out of ordinary play" effect, same skip-when-flag-IS-the-prompt rule.
   * Ignored for `features` — this is markers-only. */
  markerImageFor?: (marker: PointMarker) => string | null;
  /** Whether to draw the tiny-country dot markers and the microstate insets (Vatican City, the
   * Caribbean cluster, ...) on top of the ordinary country shapes. Defaults to true — every
   * existing caller (the country quiz, the mastery map, lookup) wants these. Set to false for a
   * `markers`-only screen (seas/oceans, US states): those tiny-country dots are indistinguishable
   * on sight from the quiz's OWN markers and aren't relevant to a non-country quiz anyway, so
   * left on they'd just be confusing clutter mixed in with the real targets. */
  showCountryMarkers?: boolean;
  /** How to color each shape — the caller decides everything (default fill, target
   * highlighted, right/wrong feedback, mastery-map coloring, ...); this component only knows
   * how to draw and how to pan/zoom/tap. */
  fillFor: (feature: MapFeature) => string;
  /** Optional flag emoji to stamp at a shape's centroid, on top of its fill — e.g. QuizScreen
   * shows the answered country's flag once it's been revealed, building a "learn the flags"
   * effect out of ordinary play instead of needing a dedicated mode for it. Return null (or omit
   * this prop entirely) for a feature that shouldn't show one right now. Purely decorative:
   * counter-scaled the same way the tiny-country markers are so it stays a constant, legible
   * size regardless of zoom, and doesn't affect hit-testing at all. */
  flagFor?: (feature: MapFeature) => string | null;
  /** Fires for a genuine tap/click (not the tail end of a pan or pinch) on any shape —
   * including background-only territories; the caller decides whether to act on
   * `feature.quizzable`. Also fires for taps inside an inset box (see geo.ts's INSET_GROUPS). */
  onCountryTap?: (feature: MapFeature) => void;
  /** When set (and changes to a new id), the map auto-pans/zooms to center that country —
   * "quickly see where the thing you're guessing actually is," for quiz modes where the
   * country's identity isn't itself the secret (see QuizScreen's revealsLocationOnMap). Purely
   * an initial view: the player can still freely pan/zoom away afterward, same as any other
   * transform change. Ignored (no-op) for an id the map has no feature for. */
  focusCountryId?: string | null;
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
  markers,
  markerFillFor,
  markerImageFor,
  onMarkerTap,
  showCountryMarkers = true,
  focusCountryId,
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

  const markerById = useMemo(() => {
    const m = new Map<string, PointMarker>();
    for (const marker of markers ?? []) m.set(marker.id, marker);
    return m;
  }, [markers]);

  function handleTap(target: Element | null) {
    if (!target) return;
    const markerId = target.getAttribute('data-marker-id');
    if (markerId !== null) {
      const marker = markerById.get(markerId);
      if (marker) onMarkerTap?.(marker);
      return;
    }
    if (!onCountryTap || !features) return;
    const indexAttr = target.getAttribute('data-feature-index');
    if (indexAttr === null) return;
    const feature = features[Number(indexAttr)];
    if (feature) onCountryTap(feature);
  }

  const { transform, reset, focusOn, handlers } = usePanZoom(svgRef, MAP_VIEWBOX, handleTap);

  useEffect(() => {
    if (!focusCountryId) return;
    const feature = featureById.get(focusCountryId);
    if (!feature) return;
    focusOn({ x: feature.centroid[0], y: feature.centroid[1] }, AUTO_FOCUS_SCALE);
  }, [focusCountryId, featureById, focusOn]);

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
              className={f.quizzable ? 'world-map__country' : 'world-map__country world-map__country--bg'}
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
                  <text className="world-map__flag" pointerEvents="none">
                    {flag}
                  </text>
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
                  <text y={-15} className="world-map__flag" pointerEvents="none">
                    {flagFor(f)}
                  </text>
                )}
              </g>
            ) : null,
          )}
          {/* Point markers for quiz universes with no boundary polygon at all (seas/oceans, US
              states — see PointMarker's doc comment in geo.ts). Same constant-on-screen-size,
              invisible-tap-radius-under-a-visible-dot approach as the tiny-country markers just
              above, just driven by `markers` instead of `features`. */}
          {markers?.map((marker) => (
            <g key={marker.id} transform={`translate(${marker.x} ${marker.y}) scale(${1 / transform.scale})`}>
              <circle data-marker-id={marker.id} r={marker.tapRadius} fill="transparent" pointerEvents="all" />
              <circle data-marker-id={marker.id} r={5} fill={markerFillFor?.(marker) ?? '#888'} className="world-map__tiny-marker" />
              {/* Offset above the dot, same reasoning as the tiny-country flag stamp below — the
                  dot's own color is still the correct/wrong signal, the image sits alongside it
                  instead of covering it. */}
              {markerImageFor && markerImageFor(marker) && (
                <image href={markerImageFor(marker)!} x={-8} y={-26} width={16} height={11} pointerEvents="none" />
              )}
            </g>
          ))}
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
