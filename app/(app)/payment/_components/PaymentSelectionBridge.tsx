"use client";

import { forwardRef } from "react";

/** 선택 행에서 상세 패널의 외곽선까지 이어지는 역라운드 연결부. */
const PaymentSelectionBridge = forwardRef<SVGSVGElement, { mode?: "company" | "institution" }>(function PaymentSelectionBridge({ mode = "company" }, ref) {
  const institution = mode === "institution";
  return (
    <svg ref={ref} aria-hidden="true" preserveAspectRatio="none" className="payment-selection-link pointer-events-none absolute z-20 overflow-hidden opacity-0 transition-opacity duration-150">
      <defs>
        <linearGradient id="payment-selection-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={institution ? "#fee2e2" : "#dbeafe"} />
          <stop offset="35%" stopColor={institution ? "#fef2f2" : "#eff6ff"} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path data-bridge-fill fill="url(#payment-selection-gradient)" />
      <path data-bridge-edge fill="none" stroke={institution ? "#fecaca" : "#bfdbfe"} strokeWidth="1" />
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
  const curveX = Math.max(3, width * 0.55);
  const upper = `M 0 ${startY} C ${curveX} ${startY} ${curveX} 0 ${width} 0`;
  const lowerCurve = `C ${curveX} ${height} ${curveX} ${endY} 0 ${endY}`;
  bridge.querySelector("[data-bridge-fill]")?.setAttribute("d", `${upper} L ${width} ${height} ${lowerCurve} Z`);
  // 오른쪽 선은 SVG 안쪽 0.5px에 그려 상세 패널 외곽선을 침범하지 않는다.
  bridge.querySelector("[data-bridge-edge]")?.setAttribute("d", `${upper} M ${width - 0.5} 0 L ${width - 0.5} ${height} M ${width} ${height} ${lowerCurve}`);
  bridge.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const bounds = root.getBoundingClientRect();
  bridge.style.left = `${row.right - bounds.left}px`;
  bridge.style.top = `${panel.top - bounds.top}px`;
  bridge.style.width = `${width}px`;
  bridge.style.height = `${height}px`;
  bridge.style.opacity = "1";
}
