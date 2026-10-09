"use client";

import { useState, type PointerEvent } from "react";

export const MASTER_PANE_MIN_WIDTH = 300;

export default function useMasterPaneWidth(workspaceRef: { current: HTMLDivElement | null }) {
  const [masterWidth, setMasterWidth] = useState(MASTER_PANE_MIN_WIDTH);
  const beginResize = (event: PointerEvent<HTMLButtonElement>) => {
    const root = workspaceRef.current;
    if (!root) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = masterWidth;
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const max = Math.max(360, root.clientWidth * 0.48);
      setMasterWidth(Math.min(max, Math.max(MASTER_PANE_MIN_WIDTH, startWidth + e.clientX - startX)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  return { masterWidth, setMasterWidth, beginResize };
}
