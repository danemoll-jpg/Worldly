import { useEffect, useRef, useState } from 'react';
import { getMapFeatures, MAP_VIEWBOX, MapFeature } from '../lib/geo';
import { usePanZoom } from '../lib/panZoom';

interface WorldMapProps {
  /** How to color each shape — the caller decides everything (default fill, target
   * highlighted, right/wrong feedback, mastery-map coloring, ...); this component only knows
   * how to draw and how to pan/zoom/tap. */
  fillFor: (feature: MapFeature) => string;
  /** Fires for a genuine tap/click (not the tail end of a pan or pinch) on any shape —
   * including background-only territories; the caller decides whether to act on
   * `feature.quizzable`. */
  onCountryTap?: (feature: MapFeature) => void;
  className?: string;
}

/** The core reusable map surface — flat, pannable, zoomable (mouse wheel, drag, or two-finger
 * pinch/pan on touch), shared by the quiz screens and the mastery map. Doesn't know anything
 * about quiz state; it's purely "here are shapes, here's how to color them, tell me what got
 * tapped." Map data loads asynchronously (see lib/geo.ts) and is cached after the first load,
 * so every screen after the first shows it instantly. */
export function WorldMap({ fillFor, onCountryTap, className }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [features, setFeatures] = useState<MapFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMapFeatures().then((loaded) => {
      if (!cancelled) setFeatures(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleTap(target: Element | null) {
    if (!target || !onCountryTap || !features) return;
    const indexAttr = target.getAttribute('data-feature-index');
    if (indexAttr === null) return;
    const feature = features[Number(indexAttr)];
    if (feature) onCountryTap(feature);
  }

  const { transform, reset, handlers } = usePanZoom(svgRef, MAP_VIEWBOX, handleTap);

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
          {/* Tiny countries (Vatican City, Liechtenstein, Monaco, ...) render as slivers or
              single points at any practical zoom level — a real path click target for them
              would be sub-pixel. Instead, drop a small dot at each one's centroid and counter-
              scale it by 1/transform.scale so it stays a constant, always-tappable size on
              screen regardless of zoom, layered on top so it's never hidden by a larger
              neighbor's fill. */}
          {features.map((f, i) =>
            f.isTiny ? (
              <g key={`tiny-${i}`} transform={`translate(${f.centroid[0]} ${f.centroid[1]}) scale(${1 / transform.scale})`}>
                {/* An invisible, much more forgiving tap target layered under the visible dot —
                    at this scale a real fingertip is far wider than the dot itself, so hit-
                    testing only the visible circle meant a near-miss would fall through to
                    whatever bigger country happens to be underneath instead. Radius is per-
                    country (see geo.ts's tapRadius) so two tiny countries near each other (e.g.
                    Vatican City/San Marino, or the Caribbean island states) don't steal each
                    other's taps. pointerEvents="all" makes this catch taps despite having no
                    visible fill. */}
                <circle data-feature-index={i} r={f.tapRadius} fill="transparent" pointerEvents="all" />
                <circle
                  data-feature-index={i}
                  r={5}
                  fill={fillFor(f)}
                  className={f.quizzable ? 'world-map__tiny-marker' : 'world-map__tiny-marker world-map__tiny-marker--bg'}
                />
              </g>
            ) : null,
          )}
        </g>
      </svg>
      <button type="button" className="world-map__reset" onClick={reset} title="Reset pan/zoom">
        ⟲
      </button>
    </div>
  );
}
