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

/** 상세 패널 외곽선(1px)을 덮는 폭(px). */
const BRIDGE_OVERLAP = 2;

/** 선택 박스의 모서리 R(px) — 연결부의 역라운드도 같은 R 로 뒤집어 쓴다. */
function cornerRadius(el: HTMLElement): number {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) && r > 0 ? r : 12;
}

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
  // 물방울 연결: 선택 박스의 위·아래 직선이 상세 패널 앞까지 그대로 뻗고, 끝에서 박스와 같은 R 로
  // 바깥쪽(위는 위로, 아래는 아래로) 뒤집혀 휘어 패널 외곽선에 수직으로 붙는다(역라운드).
  const r = Math.max(0, Math.min(cornerRadius(selected), width, startY, height - endY));
  const upperY = startY - r;
  const lowerY = endY + r;
  const straight = width - r;
  const upper = `M 0 ${startY} L ${straight} ${startY} A ${r} ${r} 0 0 0 ${width} ${upperY}`;
  const lowerCurve = `A ${r} ${r} 0 0 0 ${straight} ${endY} L 0 ${endY}`;
  // 채움은 패널 외곽선(1px) 위로 BRIDGE_OVERLAP 만큼 들어가 이어지는 구간의 테두리를 지운다.
  const edgeX = width + BRIDGE_OVERLAP;
  bridge.querySelector("[data-bridge-fill]")?.setAttribute("d", `${upper} L ${edgeX} ${upperY} L ${edgeX} ${lowerY} L ${width} ${lowerY} ${lowerCurve} Z`);
  // 외곽선은 박스 위·아래 선의 연장 + 역라운드만 — 이어지는 구간에는 세로선이 없다.
  bridge.querySelector("[data-bridge-edge]")?.setAttribute("d", `${upper} M ${width} ${lowerY} ${lowerCurve}`);
  bridge.setAttribute("viewBox", `0 0 ${edgeX} ${height}`);
  const bounds = root.getBoundingClientRect();
  bridge.style.left = `${row.right - bounds.left}px`;
  bridge.style.top = `${panel.top - bounds.top}px`;
  bridge.style.width = `${edgeX}px`;
  bridge.style.height = `${height}px`;
  bridge.style.opacity = "1";
}
