"use client";

import { forwardRef } from "react";

/** 선택 행에서 상세 패널의 외곽선까지 이어지는 역라운드 연결부. */
const PaymentSelectionBridge = forwardRef<SVGSVGElement, { mode?: "company" | "institution" }>(function PaymentSelectionBridge({ mode = "company" }, ref) {
  const institution = mode === "institution";
  return (
    <svg ref={ref} aria-hidden="true" preserveAspectRatio="none" className="payment-selection-link pointer-events-none absolute z-20 overflow-hidden opacity-0 transition-opacity duration-150">
      <defs>
        <linearGradient id="payment-selection-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={institution ? "#fef2f2" : "#eff6ff"} />
          <stop offset="100%" stopColor={institution ? "#fee2e2" : "#dbeafe"} />
        </linearGradient>
        <linearGradient id="payment-selection-edge-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={institution ? "#f87171" : "#60a5fa"} />
          <stop offset="100%" stopColor={institution ? "#fecaca" : "#bfdbfe"} />
        </linearGradient>
      </defs>
      <path data-bridge-fill fill="url(#payment-selection-gradient)" />
      <path data-bridge-edge fill="none" stroke="url(#payment-selection-edge-gradient)" strokeWidth="1" />
    </svg>
  );
});

export default PaymentSelectionBridge;

export function syncPaymentSelectionBridge(root: HTMLDivElement | null, pane: HTMLDivElement | null, bridge: SVGSVGElement | null) {
  const detail = root?.querySelector<HTMLElement>(".payment-detail-shell");
  // 접힌 기관에서는 선택 행이 DOM에서 사라지므로 활성 기관 헤더에 연결한다.
  const selected = pane?.querySelector<HTMLElement>('[aria-selected="true"]')
    ?? pane?.querySelector<HTMLElement>('[data-active-institution="true"]');
  if (!root || !pane || !bridge || !detail || !selected) {
    if (bridge) bridge.style.opacity = "0";
    return;
  }
  const row = selected.getBoundingClientRect();
  const viewport = pane.getBoundingClientRect();
  const top = Math.max(row.top, viewport.top);
  const bottom = Math.min(row.bottom, viewport.bottom);
  if (bottom - top < 12) { bridge.style.opacity = "0"; return; }

  const panel = detail.getBoundingClientRect();
  const width = panel.left - row.right;
  const height = panel.height;
  if (width <= 1 || height <= 0) { bridge.style.opacity = "0"; return; }
  const startY = Math.max(0, Math.min(height, top - panel.top));
  const endY = Math.max(0, Math.min(height, bottom - panel.top));
  if (endY <= startY) { bridge.style.opacity = "0"; return; }
  // 곡선은 선택 행 가까이에서만 휘고, 패널 전체 높이에는 얇은 외곽선만 남긴다.
  const upperY = Math.max(0, startY - 10);
  const lowerY = Math.min(height, endY + 10);
  const nearX = width * 0.4;
  const farX = width * 0.8;
  const upper = `M 0 ${startY} C ${nearX} ${startY} ${farX} ${upperY} ${width} ${upperY}`;
  const lowerCurve = `C ${farX} ${lowerY} ${nearX} ${endY} 0 ${endY}`;
  bridge.querySelector("[data-bridge-fill]")?.setAttribute("d", `${upper} L ${width} ${lowerY} ${lowerCurve} Z`);
  // 세로선은 SVG 안쪽 0.5px에 그려 상세 패널 외곽선을 침범하지 않는다.
  bridge.querySelector("[data-bridge-edge]")?.setAttribute("d", `M ${width - 0.5} 0 L ${width - 0.5} ${height} ${upper} M ${width} ${lowerY} ${lowerCurve}`);
  bridge.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const bounds = root.getBoundingClientRect();
  bridge.style.left = `${row.right - bounds.left}px`;
  bridge.style.top = `${panel.top - bounds.top}px`;
  bridge.style.width = `${width}px`;
  bridge.style.height = `${height}px`;
  bridge.style.opacity = "1";
}
