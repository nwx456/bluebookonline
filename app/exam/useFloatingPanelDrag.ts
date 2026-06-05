"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type FloatingPanelPosition = { x: number; y: number };

type DragSession = {
  startX: number;
  startY: number;
  posX: number;
  posY: number;
};

export function clampFloatingPanelPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  padding: number,
  allowPartialOffscreenLeft = false
): FloatingPanelPosition {
  const minX = allowPartialOffscreenLeft ? padding - panelWidth : padding;
  const maxX = window.innerWidth - padding;
  const minY = 0;
  const maxY = window.innerHeight - padding;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

export function getDefaultBottomRightPosition(
  panelWidth: number,
  panelHeight: number,
  padding = 16
): FloatingPanelPosition {
  if (typeof window === "undefined") {
    return { x: padding, y: padding };
  }
  return clampFloatingPanelPosition(
    window.innerWidth - panelWidth - padding,
    window.innerHeight - panelHeight - padding,
    panelWidth,
    panelHeight,
    padding
  );
}

export function useFloatingPanelDrag(options: {
  panelWidth: number;
  panelHeight: number;
  initialPosition?: FloatingPanelPosition;
  padding?: number;
  /** Match legacy AP calculator: panel may slide partially off the left edge. */
  allowPartialOffscreenLeft?: boolean;
}) {
  const {
    panelWidth,
    panelHeight,
    initialPosition,
    padding = 16,
    allowPartialOffscreenLeft = false,
  } = options;

  const [position, setPosition] = useState<FloatingPanelPosition>(
    initialPosition ?? { x: padding, y: padding }
  );
  const dragRef = useRef<DragSession | null>(null);
  const initializedRef = useRef(false);
  const optionsRef = useRef({ panelWidth, panelHeight, padding, allowPartialOffscreenLeft });
  optionsRef.current = { panelWidth, panelHeight, padding, allowPartialOffscreenLeft };

  useEffect(() => {
    if (initializedRef.current || initialPosition) return;
    initializedRef.current = true;
    setPosition(getDefaultBottomRightPosition(panelWidth, panelHeight, padding));
  }, [initialPosition, panelWidth, panelHeight, padding]);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      const onMouseMove = (e: MouseEvent) => {
        const r = dragRef.current;
        if (!r) return;
        const { panelWidth: w, panelHeight: h, padding: p, allowPartialOffscreenLeft: partial } =
          optionsRef.current;
        const dx = e.clientX - r.startX;
        const dy = e.clientY - r.startY;
        setPosition(clampFloatingPanelPosition(r.posX + dx, r.posY + dy, w, h, p, partial));
      };

      const onTouchMove = (e: TouchEvent) => {
        const r = dragRef.current;
        if (!r) return;
        const t = e.touches[0];
        if (!t) return;
        e.preventDefault();
        const { panelWidth: w, panelHeight: h, padding: p, allowPartialOffscreenLeft: partial } =
          optionsRef.current;
        const dx = t.clientX - r.startX;
        const dy = t.clientY - r.startY;
        setPosition(clampFloatingPanelPosition(r.posX + dx, r.posY + dy, w, h, p, partial));
      };

      const endDrag = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", endDrag);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", endDrag);
      };

      dragRef.current = {
        startX: clientX,
        startY: clientY,
        posX: position.x,
        posY: position.y,
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", endDrag);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", endDrag);
    },
    [position.x, position.y]
  );

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    },
    [startDrag]
  );

  const onTouchDragStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startDrag(t.clientX, t.clientY);
    },
    [startDrag]
  );

  return { position, setPosition, onDragStart, onTouchDragStart };
}
