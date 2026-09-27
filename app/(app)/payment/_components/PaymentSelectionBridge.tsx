"use client";

import { forwardRef } from "react";

/** 선택 행의 경계에서 상세 배경으로 퍼지는 역라운드 연결부. */
const PaymentSelectionBridge = forwardRef<SVGSVGElement, { mode?: "company" | "institution" }>(function PaymentSelectionBridge({ mode = "company" }, ref) {
  const institution = mode === "institution";
  return (
    <svg ref={ref} aria-hidden="true" preserveAspectRatio="none" className="payment-selection-link pointer-events-none absolute z-20 overflow-visible opacity-0 transition-opacity duration-150">
      <defs>
        <linearGradient id="payment-selection-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={institution ? "#fef2f2" : "#eff6ff"} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path data-bridge-fill fill="url(#payment-selection-gradient)" />
      <path data-bridge-edge fill="none" stroke={institution ? "#f87171" : "#60a5fa"} strokeOpacity="0.8" strokeWidth="1" />
    </svg>
  );
});

export default PaymentSelectionBridge;

export function syncPaymentSelectionBridge(root: HTMLDivElement | null, pane: HTMLDivElement | null, bridge: SVGSVGElement | null) {
  const detail = root?.querySelector<HTMLElement>(".payment-detail-shell");
  const selected = pane?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (!root || !pane || !bridge || !detail || !selected) {
    if (bridge) bridge.style.opacity = "0";
    return;
  }
  const row = selected.getBoundingClientRect();
  const viewport = pane.getBoundingClientRect();
  const top = Math.max(row.top, viewport.top);
  const bottom = Math.min(row.bottom, viewport.bottom);
  if (bottom - top < 12) { bridge.style.opacity = "0"; return; }

  const detailX = detail.getBoundingClientRect().left;
  const width = Math.max(8, detailX - row.right + 6);
  const flareTop = Math.min(14, Math.max(0, top - viewport.top));
  const flareBottom = Math.min(14, Math.max(0, viewport.bottom - bottom));
  const height = bottom - top + flareTop + flareBottom;
  const startY = flareTop;
  const endY = height - flareBottom;
  const curveX = Math.max(3, width * 0.55);
  const upper = `M 0 ${startY} C ${curveX} ${startY} ${curveX} 0 ${width} 0`;
  const lowerCurve = `C ${curveX} ${height} ${curveX} ${endY} 0 ${endY}`;
  bridge.querySelector("[data-bridge-fill]")?.setAttribute("d", `${upper} L ${width} ${height} ${lowerCurve} Z`);
  bridge.querySelector("[data-bridge-edge]")?.setAttribute("d", `${upper} M ${width} ${height} ${lowerCurve}`);
  bridge.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const bounds = root.getBoundingClientRect();
  bridge.style.left = `${row.right - bounds.left - 1}px`;
  bridge.style.top = `${top - bounds.top - flareTop}px`;
  bridge.style.width = `${width}px`;
  bridge.style.height = `${height}px`;
  bridge.style.opacity = "1";
}
