// Drag-to-pan, wheel-to-zoom, and two-finger pinch-to-zoom over an SVG map — built on the
// Pointer Events API so mouse and touch (including iPad) share one code path instead of two
// separate mouse/touch handler sets. Everything here works in the SVG's own viewBox coordinate
// space (see geo.ts's MAP_VIEWBOX), not raw screen pixels, so the transform composes cleanly
// with the already-projected country paths.
import { useCallback, useRef, useState } from 'react';

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 10;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Rescales `transform` around a fixed point (in viewBox units) so that point stays visually
 * stationary — the same math a "zoom toward the cursor" or "zoom toward the pinch center" needs. */
function zoomAtPoint(transform: Transform, point: { x: number; y: number }, nextScale: number): Transform {
  const contentX = (point.x - transform.x) / transform.scale;
  const contentY = (point.y - transform.y) / transform.scale;
  return {
    scale: nextScale,
    x: point.x - contentX * nextScale,
    y: point.y - contentY * nextScale,
  };
}

/** Clamps pan so the content can't be dragged entirely off-screen — content edges can come at
 * most `slack` viewBox units past the container's edge. */
function clampPan(transform: Transform, viewBox: { width: number; height: number }): Transform {
  const slack = 200;
  const minX = viewBox.width - viewBox.width * transform.scale - slack;
  const maxX = slack;
  const minY = viewBox.height - viewBox.height * transform.scale - slack;
  const maxY = slack;
  return {
    ...transform,
    x: Math.min(maxX, Math.max(minX, transform.x)),
    y: Math.min(maxY, Math.max(minY, transform.y)),
  };
}

export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

/** A "tap" is a single-pointer gesture that never grew a second finger and never moved more
 * than this many client pixels — anything past that was a pan, not a request to select
 * whatever's underneath it. */
const TAP_MOVE_THRESHOLD_PX = 6;

export function usePanZoom(
  svgRef: React.RefObject<SVGSVGElement>,
  viewBox: { width: number; height: number },
  onTap?: (target: Element | null) => void,
) {
  const [transform, setTransform] = useState<Transform>(IDENTITY_TRANSFORM);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragState = useRef<{ x: number; y: number; start: Transform } | null>(null);
  const pinchState = useRef<{ distance: number; midpoint: { x: number; y: number }; start: Transform } | null>(null);
  // Tracks whether the CURRENT gesture (from the first finger down to the last finger up)
  // still qualifies as a tap — reset fresh each time a gesture begins.
  const gesture = useRef<{ target: Element | null; downX: number; downY: number; moved: boolean; multiTouch: boolean } | null>(null);

  const toViewBoxPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * viewBox.width,
        y: ((clientY - rect.top) / rect.height) * viewBox.height,
      };
    },
    [svgRef, viewBox.width, viewBox.height],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      dragState.current = { x: e.clientX, y: e.clientY, start: transform };
      pinchState.current = null;
      gesture.current = { target: e.target as Element, downX: e.clientX, downY: e.clientY, moved: false, multiTouch: false };
    } else if (pointers.current.size === 2) {
      dragState.current = null;
      if (gesture.current) gesture.current.multiTouch = true;
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchState.current = {
        distance: Math.hypot(dx, dy) || 1,
        midpoint: toViewBoxPoint((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
        start: transform,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform, toViewBoxPoint]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (gesture.current && !gesture.current.moved) {
        const moved = Math.hypot(e.clientX - gesture.current.downX, e.clientY - gesture.current.downY);
        if (moved > TAP_MOVE_THRESHOLD_PX) gesture.current.moved = true;
      }

      if (pointers.current.size >= 2 && pinchState.current) {
        const pts = Array.from(pointers.current.values()).slice(0, 2);
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const distance = Math.hypot(dx, dy) || 1;
        const { start, midpoint, distance: startDistance } = pinchState.current;
        const nextScale = clampScale(start.scale * (distance / startDistance));
        setTransform(clampPan(zoomAtPoint(start, midpoint, nextScale), viewBox));
      } else if (pointers.current.size === 1 && dragState.current) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const dx = ((e.clientX - dragState.current.x) / rect.width) * viewBox.width;
        const dy = ((e.clientY - dragState.current.y) / rect.height) * viewBox.height;
        const { start } = dragState.current;
        setTransform(clampPan({ ...start, x: start.x + dx, y: start.y + dy }, viewBox));
      }
    },
    [svgRef, viewBox],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    pinchState.current = null;

    if (pointers.current.size === 0) {
      const g = gesture.current;
      gesture.current = null;
      dragState.current = null;
      if (g && !g.moved && !g.multiTouch) onTap?.(g.target);
    } else if (pointers.current.size === 1) {
      const [, pt] = Array.from(pointers.current.entries())[0];
      setTransform((current) => {
        dragState.current = { x: pt.x, y: pt.y, start: current };
        return current;
      });
      // A finger lifted off a pinch but one remains down — that's not a tap no matter what
      // happens next, since it started as two-finger contact.
      if (gesture.current) gesture.current.multiTouch = true;
    }
  }, [onTap]);

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const point = toViewBoxPoint(e.clientX, e.clientY);
      setTransform((prev) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        return clampPan(zoomAtPoint(prev, point, clampScale(prev.scale * factor)), viewBox);
      });
    },
    [toViewBoxPoint, viewBox],
  );

  const reset = useCallback(() => setTransform(IDENTITY_TRANSFORM), []);

  return {
    transform,
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
  };
}
