"use client";

import { forwardRef } from "react";

/** 선택 행에서 상세 패널의 외곽선까지 이어지는 역라운드 연결부. */
const PaymentSelectionBridge = forwardRef<SVGSVGElement, { mode?: "company" | "institution" }>(function PaymentSelectionBridge({ mode = "company" }, ref) {
  const institution = mode === "institution";
  return (
    <svg ref={ref} aria-hidden="true" preserveAspectRatio="none" className="payment-selection-link pointer-events-none absolute z-20 overflow-hidden opacity-0 transition-opacity duration-150">
      <defs>
        <linearGradient id="payment-selection-gradient" x1="0" y1="0" x2="1" y2="0">
          {/* 선택 행 오른쪽 끝색(red/blue-50)에서 시작해 상세 패널 바탕(흰색)으로 끝난다 —
              양 끝 이음새에 색 경계가 생기지 않게. */}
          <stop offset="0%" stopColor={institution ? "#fef2f2" : "#eff6ff"} />
          <stop offset="100%" stopColor="#ffffff" />
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

/** 곡선이 선택 행 위아래로 벌어지는 높이(px). */
const BRIDGE_FLARE = 24;
/** 상세 패널 외곽선(1px)을 덮는 폭(px). */
const BRIDGE_OVERLAP = 2;

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
  // 곡선은 양 끝 접선이 수평인 S자로 넉넉히(FLARE) 벌어져 패널 외곽선에 붙는다.
  const upperY = Math.max(0, startY - BRIDGE_FLARE);
  const lowerY = Math.min(height, endY + BRIDGE_FLARE);
  const midX = width * 0.5;
  const upper = `M 0 ${startY} C ${midX} ${startY} ${midX} ${upperY} ${width} ${upperY}`;
  const lowerCurve = `C ${midX} ${lowerY} ${midX} ${endY} 0 ${endY}`;
  // 채움은 패널 외곽선(1px) 위로 BRIDGE_OVERLAP 만큼 들어가 이어지는 구간의 테두리를 지운다.
  const edgeX = width + BRIDGE_OVERLAP;
  bridge.querySelector("[data-bridge-fill]")?.setAttribute("d", `${upper} L ${edgeX} ${upperY} L ${edgeX} ${lowerY} L ${width} ${lowerY} ${lowerCurve} Z`);
  // 외곽선은 두 곡선만 — 이어지는 구간에는 세로선을 긋지 않는다.
  bridge.querySelector("[data-bridge-edge]")?.setAttribute("d", `${upper} M ${width} ${lowerY} ${lowerCurve}`);
  bridge.setAttribute("viewBox", `0 0 ${edgeX} ${height}`);
  const bounds = root.getBoundingClientRect();
  bridge.style.left = `${row.right - bounds.left}px`;
  bridge.style.top = `${panel.top - bounds.top}px`;
  bridge.style.width = `${edgeX}px`;
  bridge.style.height = `${height}px`;
  bridge.style.opacity = "1";
}
